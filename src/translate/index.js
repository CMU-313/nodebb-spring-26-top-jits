
/* eslint-disable strict */
//var request = require('request');

const translatorApi = module.exports;

// translatorApi.translate = function (postData) {
// return ['is_english', postData.content];
// };

translatorApi.translate = async function (postData) {
	const TRANSLATOR_API = 'http://172.17.0.1:5000';
	try {
		const response = await fetch(TRANSLATOR_API + '/?content=' + encodeURIComponent(postData.content));
		const data = await response.json();
		return [data.is_english, data.translated_content];
	} catch (e) {
		return [true, postData.content];
	}
};