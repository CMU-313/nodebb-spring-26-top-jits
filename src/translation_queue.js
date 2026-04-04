'use strict';

const db = require('./database');

const TranslationQueue = module.exports;

let isProcessing = false;
const MAX_CONCURRENT = 1;
let currentConcurrent = 0;
const QUEUE_INTERVAL = 1000; // 1 second

// Add a post to the retry queue
TranslationQueue.add = async function (pid) {
	try {
		await db.setAdd('translation:retry_queue', pid);
		console.log('[TranslationQueue] Added post', pid, 'to retry queue');
	} catch (err) {
		console.error('[TranslationQueue] Error adding post to queue:', err);
	}
};

// Remove a post from the retry queue
TranslationQueue.remove = async function (pid) {
	try {
		await db.setRemove('translation:retry_queue', pid);
	} catch (err) {
		console.error('[TranslationQueue] Error removing post from queue:', err);
	}
};

// Get all posts in the retry queue
TranslationQueue.getPending = async function () {
	try {
		return await db.getSetMembers('translation:retry_queue');
	} catch (err) {
		console.error('[TranslationQueue] Error getting pending translations:', err);
		return [];
	}
};

// Process the translation retry queue
TranslationQueue.process = async function () {
	if (isProcessing || currentConcurrent >= MAX_CONCURRENT) {
		return;
	}

	isProcessing = true;
	const pids = await TranslationQueue.getPending();

	if (pids.length === 0) {
		isProcessing = false;
		return;
	}

	console.log(`[TranslationQueue] Processing ${pids.length} pending translation(s)`);

	// Process one post at a time (concurrency limit of 1)
	const pid = pids[0];
	currentConcurrent += 1;

	try {
		console.log(`[TranslationQueue] Retrying translation for post ${pid}`);
		const success = await TranslationQueue.retryTranslation(pid);
		// Remove from queue only if translation succeeded
		if (success) {
			await TranslationQueue.remove(pid);
			console.log(`[TranslationQueue] Removed post ${pid} from retry queue`);
		} else {
			console.log(`[TranslationQueue] Translation failed for post ${pid}, keeping in queue`);
		}
	} catch (err) {
		console.error(`[TranslationQueue] Error retrying translation for post ${pid}:`, err);
		// Keep in queue for next attempt
	} finally {
		currentConcurrent -= 1;
		isProcessing = false;
	}
};

// Retry translation for a single post
TranslationQueue.retryTranslation = async function (pid) {
	const translate = require('./translate');

	const postData = await db.getObject(`post:${pid}`);

	if (!postData) {
		return false;
	}

	const [isEnglish, translatedContent, translationStatus] = await translate.translate(postData);

	// Update the post with new translation data
	await db.setObject(`post:${pid}`, {
		isEnglish,
		translatedContent,
		translationStatus,
	});

	// Return true if translation succeeded (API was reachable)
	return translationStatus === true;
};

// Start the queue processor
TranslationQueue.start = function () {
	TranslationQueue._interval = setInterval(async () => {
		try {
			await TranslationQueue.process();
		} catch (err) {
			console.error('[TranslationQueue] Error in interval:', err);
		}
	}, QUEUE_INTERVAL);

	console.log('[TranslationQueue] Started with interval:', QUEUE_INTERVAL, 'ms');
};

// Stop the queue processor
TranslationQueue.stop = async function () {
	// Clear any pending interval
	if (TranslationQueue._interval) {
		clearInterval(TranslationQueue._interval);
		TranslationQueue._interval = null;
	}
	isProcessing = false;
	
	// Clear the retry queue on shutdown
	const db = require('./database');
	try {
		await db.delete('translation:retry_queue');
	} catch (err) {
		console.error('[TranslationQueue] Error clearing queue on shutdown:', err);
	}
	
	console.log('[TranslationQueue] Stopped');
};
