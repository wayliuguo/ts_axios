import cookie from '../helpers/cookie'
import { createError } from '../helpers/error'
import { parseHeaders } from '../helpers/headers'
import { isURLSameOrigin } from '../helpers/url'
import { isFormData } from '../helpers/util'
import { AxiosPromise, AxiosRequestConfig, AxiosResponse } from '../types'

export default function xhr(config: AxiosRequestConfig): AxiosPromise {
  return new Promise((resolve, reject) => {
    const {
      data = null,
      url,
      method = 'get',
      headers,
      responseType,
      timeout,
      cancelToken,
      withCredentials,
      xsrfCookieName,
      xsrfHeaderName,
      onDownloadProgress,
      onUploadProgress
    } = config

    const request = new XMLHttpRequest()

    if (timeout) {
      request.timeout = timeout
    }

    if (withCredentials) {
      request.withCredentials = true
    }

    if ((withCredentials || isURLSameOrigin(url!)) && xsrfCookieName){
      const xsrfValue = cookie.read(xsrfCookieName)
      if (xsrfValue) {
        headers[xsrfHeaderName!] = xsrfValue
      }
    }

    if (onDownloadProgress) {
      request.onprogress = onDownloadProgress
    }

    if (onUploadProgress) {
      request.upload.onprogress = onUploadProgress
    }

    if (isFormData(data)) {
      delete headers['Content-Type']
    }

    if (responseType) {
      request.responseType = responseType
    }

    request.open(method.toUpperCase(), url!, true)

    processCancel()

    function processCancel(): void {
      if (cancelToken) {
        cancelToken.promise
          .then(reason => {
            request.abort()
            reject(reason)
          })
          .catch(
            /* istanbul ignore next */
            () => {
              // do nothing
            }
          )
      }
    }

    request.onreadystatechange = function handleLoad() {
      if (request.readyState !== 4) {
        return
      }

      if (request.status === 0) {
        return
      }

      const responseHeaders = parseHeaders(request.getAllResponseHeaders())
      const responseData =
        responseType && responseType !== 'text' ? request.response : request.responseText
      const response: AxiosResponse = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config,
        request
      }
      handleResponse(response)
    }
    function handleResponse(response: AxiosResponse) {
      if (response.status >= 200 && response.status < 300) {
        resolve(response)
      } else {
        reject(
          createError(
            `Request failed with status code ${response.status}`,
            config,
            null,
            request,
            response
          )
        )
      }
    }

    request.onerror = function handleError() {
      reject(createError('Network Error', config, null, request))
    }

    request.ontimeout = function handleTimeout() {
      reject(
        createError(`Timeout of ${config.timeout} ms exceeded`, config, 'ECONNABORTED', request)
      )
    }

    Object.keys(headers).forEach(name => {
      if (data === null && name.toLowerCase() === 'content-type') {
        delete headers[name]
      } else {
        request.setRequestHeader(name, headers[name])
      }
    })

    request.send(data)
  })
}
