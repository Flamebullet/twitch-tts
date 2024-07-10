const say = require('say');
const tmi = require('tmi.js');

const { user, password, reademotes, ignoreprefix } = require('./cred.js');

const client = new tmi.Client({
	options: { debug: false },
	connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: user,
		password: password // https://twitchapps.com/tmi/
	},
	channels: []
});

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeCharactersByRanges(inputString, emotes) {
	let unsortedrange = Object.values(emotes)[0];
	let ranges = [];
	for (let index in unsortedrange) {
		const value = unsortedrange[index];
		ranges.push(value.split('-'));
	}
	// Sort ranges by end index in descending order
	const sortedRanges = ranges.sort((a, b) => b[1] - a[1]);

	// Remove substrings from inputString
	for (let [start, end] of sortedRanges) {
		end++;
		inputString = inputString.slice(0, start) + inputString.slice(end);
	}

	return inputString;
}

function tts(username, text) {
	return new Promise((resolve, reject) => {
		say.speak(`${username} said ${text}`, null, null, (err) => {
			if (err) {
				reject(console.error(err));
			}

			resolve(console.log(`${username}: ${text}`));
		});
	});
}

async function main() {
	await client.connect();
	await client.join(user);

	let ttsQueue = [],
		currentlySpeaking = false;
	client.on('message', async (channel, tags, message, self) => {
		// ignore messages with prefix
		if (ignoreprefix && message.startsWith('!')) return;
		if (!reademotes && tags['emote-only']) return;
		let channelName = channel.substring(1);
		let msg = message;
		if (!reademotes && tags.emotes) {
			msg = removeCharactersByRanges(msg, tags.emotes);
		}

		ttsQueue.push({ username: channelName, message: msg });

		if (!currentlySpeaking) speak();
	});

	async function speak() {
		currentlySpeaking = true;
		while (ttsQueue.length > 0) {
			const ttsMsg = ttsQueue.shift();
			await tts(ttsMsg.username, ttsMsg.message);
			await sleep(500);
			if (ttsQueue.length == 0) currentlySpeaking = false;
		}
	}
}

main();
