"use strict";

const request = require("request-promise-native");


class HttpService {

    /**
     * @param {Object} [requestDefaultOptions] - default request options to use
     */
    constructor (requestDefaultOptions = null) {
        this.request = requestDefaultOptions ? request.defaults(requestDefaultOptions) : request;
    }

    /**
     * @private
     * @param {Object} options
     * @return {Promise<*>}
     */
    async performRequest(options) {
        return await this.request(options);
    }

    /**
     * @param {String|Object} url
     * @return {Promise<*>}
     */
    async getJson(url) {
        let options = {
            url,
            json: true
        };

        return await this.performRequest(options);
    }

    async getText(url) {
        return await this.performRequest(url);
    }
}

module.exports = HttpService;
