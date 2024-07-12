const say = require('say');
const tmi = require('tmi.js');
const fs = require('fs');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const axios = require('axios');
const readline = require('readline');
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function questionPrompt(q) {
	return new Promise((resolve, reject) => {
		rl.question(q, (userInput) => {
			resolve(userInput);
		});
	});
}

let { user, password, reademotes, ignoreprefix, voice, speed, ignoreself, speechformat } = require('./cred.js');

async function downloadFile() {
	try {
		const response = await axios({
			url: 'https://github.com/Flamebullet/twitch-tts/releases/download/v1.1.0/WinKeyServer.exe', // Replace with your file URL
			method: 'GET',
			responseType: 'stream' // Important: Set the response type to 'stream'
		});

		const writeStream = fs.createWriteStream(process.env.USERPROFILE + '/twitch-tts/WinKeyServer.exe'); // Specify the local file path
		response.data.pipe(writeStream);

		await new Promise((resolve) => {
			writeStream.on('finish', resolve);
		});

		console.log('File download completed successfully. Restart program to start using.');
	} catch (error) {
		console.error('Error downloading file:', error.message);
		console.log(
			'You can try to manually download the file at https://github.com/Flamebullet/twitch-tts/releases/download/v1.1.0/WinKeyServer.exe then place it in %USERPROFILE%/twitch-tts/ folder in windows'
		);
		process.exit(1);
	}
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
		say.speak(speechformat.replace('$username', username).replace('$message', text), voice, speed, (err) => {
			if (err) {
				reject(console.error(err));
			}

			// resolve(console.log(`${username}: ${text}`));
			resolve();
		});
	});
}

async function main() {
	const folderPath = process.env.USERPROFILE + '/twitch-tts';
	if (!fs.existsSync(folderPath)) {
		fs.mkdirSync(folderPath);
	}
	if (!fs.existsSync(process.env.USERPROFILE + '/twitch-tts/WinKeyServer.exe')) {
		console.log('Downloading WinKeyServer');
		await downloadFile();
		process.exit(1);
	}
	const listener = new GlobalKeyboardListener();

	listener.addListener((e, down) => {
		if (down['S'] && (down['LEFT ALT'] || down['RIGHT ALT'])) {
			skipTTS();
		}
	});

	listener.start();

	// Create .env file for initialisation
	if (user == undefined || password == undefined) {
		let reply = await questionPrompt('USERNAME(Enter twitch username): ');
		user = reply;

		reply = await questionPrompt('\nPASSWORD(NOT YOUR TWITCH ACCOUNT PASSWORD! Get your password here https://twitchapps.com/tmi/): ');
		password = reply;

		reply = await questionPrompt('\nRead Emotes(1 for yes, 0 for no, recommended: 0): ');
		if (reply != 0 || reply != 1) reply = 0;
		reademotes = reply;

		reply = await questionPrompt('\nIgnore Prefix(1 for yes, 0 for no, recommended: 1): ');
		if (reply != 0 || reply != 1) reply = 1;
		ignoreprefix = reply;

		let voicesList;
		function getVoices() {
			return new Promise((resolve) => {
				say.getInstalledVoices((err, voice) => {
					return resolve(voice);
				});
			});
		}
		async function usingVoices() {
			voicesList = await getVoices();
			console.log(
				`\n\nList of available voices: ${voicesList} \nCheck out the following link to download more: https://support.microsoft.com/en-gb/topic/download-languages-and-voices-for-immersive-reader-read-mode-and-read-aloud-4c83a8d8-7486-42f7-8e46-2b0fdf753130`
			);
		}
		await usingVoices();
		reply = await questionPrompt('\nTTS Voice(Preinstalled voices are Microsoft David Desktop (Male) and Microsoft Zira Desktop (Female):');
		if (voicesList.indexOf(reply) === -1) reply = `Microsoft David Desktop`;
		voice = reply;

		reply = await questionPrompt('\nTTS Speed(recommended: 1): ');
		if (reply != 0 || reply != 1) reply = 1;
		speed = reply;

		reply = await questionPrompt('\nIgnore own message(recommended: 1): ');
		if (reply != 0 || reply != 1) reply = 1;
		ignoreself = reply;

		reply = await questionPrompt('\nSpeech Format(Default: $username said $message): ');
		if (reply == '' || reply == undefined) reply = '$username said $message';
		speechformat = reply;

		const content = `USER=${user}
PASSWORD=${password}
READEMOTES=${reademotes}
IGNOREPREFIX=${ignoreprefix}
VOICE=${voice}
SPEED=${speed}
IGNORESELF=${ignoreself}
SPEECHFORMAT=${speechformat}`;
		const filePath = process.env.USERPROFILE + '/twitch-tts/.env'; // Specify the file path

		try {
			fs.writeFileSync(filePath, content);
			console.log('\n\n.env file created successfully!');
		} catch (err) {
			console.error('Error writing to file (synchronously):', err);
		}
	}

	let nicknames;
	const nickJsonFilePath = process.env.USERPROFILE + '/twitch-tts/nicknames.json';
	if (fs.existsSync(nickJsonFilePath)) {
		nicknames = JSON.parse(fs.readFileSync(nickJsonFilePath));
	} else {
		fs.writeFileSync(nickJsonFilePath, JSON.stringify({}));
		nicknames = {};
	}

	const client = new tmi.Client({
		options: { debug: true },
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
	await client.connect();
	await client.join(user).catch((err) => {
		console.error(err);
	});

	let joinChannels;
	const joinChannelsFilePath = process.env.USERPROFILE + '/twitch-tts/joinchannels.txt';
	if (fs.existsSync(joinChannelsFilePath)) {
		let nicknames = fs.readFileSync(joinChannelsFilePath, 'utf8');
		if (nicknames == '') {
			joinChannels = [];
		} else {
			joinChannels = nicknames.split(', ');
		}
		if (joinChannels.length > 0) {
			for (let index in joinChannels) {
				await client.join(joinChannels[index]).catch((err) => {
					console.error(err);
				});
			}
		}
	} else {
		fs.writeFileSync(joinChannelsFilePath, '', 'utf8');
		joinChannels = [];
	}

	commandPrompt();

	let ttsQueue = [],
		currentlySpeaking = false;
	client.on('message', async (channel, tags, message, self) => {
		if (((tags.badges && tags.badges.broadcaster == '1') || tags.mod) && message.startsWith('!')) {
			if (message.toLowerCase() == '!ttsskip') {
				skipTTS();
				client.say(channel, `skipped!`);
			} else if (message.split(' ')[0] == '!ttsnick') {
				setNickname(nicknames, message, nickJsonFilePath);
				client.say(channel, `${tags.username} set ${message.split(' ')[1].toLowerCase()} to ${message.split(' ')[2].toLowerCase()}!`);
			} else if (message.split(' ')[0] == '!ttsjoin') {
				joinChannelChat(client, joinChannels, message, joinChannelsFilePath);
				client.say(channel, `${tags.username} joined ${message.split(' ')[1]} chat`);
			} else if (message.split(' ')[0] == '!ttsleave') {
				leaveChannelChat(client, joinChannels, message, joinChannelsFilePath);
				client.say(channel, `${tags.username} left ${message.split(' ')[1]} chat`);
			}
		}
		// Skip messages with prefix !
		if (ignoreprefix && message.startsWith('!')) return;
		// Skip message with only emotes
		if (!reademotes && tags['emote-only']) return;
		// Skip message from yourself
		if (!ignoreself && tags.username.toLowerCase() == user.toLowerCase()) return;

		let msg = message;
		// Remove emotes from messages if dont read emotes is selected
		if (!reademotes && tags.emotes) {
			msg = removeCharactersByRanges(msg, tags.emotes);
		}

		let username = tags.username;
		if (tags.username in nicknames) {
			username = nicknames[tags.username];
		}

		ttsQueue.push({ username: username, message: msg });

		if (!currentlySpeaking) speak();
	});

	function commandPrompt() {
		rl.question('', async function (reply) {
			if (reply == '!resetconf') {
				fs.unlinkSync(process.env.USERPROFILE + '/twitch-tts/.env');
				console.log('Config file deleted! Aborting process...');
				process.exit(1);
			} else if (reply.split(' ')[0] == '!join') {
				await joinChannelChat(client, joinChannels, reply, joinChannelsFilePath);
			} else if (reply.split(' ')[0] == '!leave') {
				leaveChannelChat(client, joinChannels, reply, joinChannelsFilePath);
			} else if (reply.split(' ')[0] == '!nick') {
				setNickname(nicknames, reply, nickJsonFilePath);
			}
			commandPrompt();
		});
	}

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

function skipTTS() {
	say.stop();
	console.log('Skipped!');
}

function setNickname(nicknames, reply, nickJsonFilePath) {
	const username = reply.split(' ')[1].toLowerCase();
	const nickname = reply.split(' ')[2].toLowerCase();

	// remove @ if start with @
	if (username.startsWith('@')) {
		username = username.substring(1);
	}

	nicknames[username] = nickname;

	fs.writeFileSync(nickJsonFilePath, JSON.stringify(nicknames));
	process.env.USERPROFILE + '/twitch-tts/.env';
	console.log(`Successfully set nickname for ${username} to ${nickname}`);
}

async function joinChannelChat(client, joinChannels, reply, joinChannelsFilePath) {
	const joinChannel = reply.split(' ')[1].toLowerCase();

	// remove @ if start with @
	if (joinChannel.startsWith('@')) {
		joinChannel = joinChannel.substring(1);
	}

	await client.join(joinChannel);
	joinChannels.push(joinChannel);
	fs.writeFileSync(joinChannelsFilePath, joinChannels.join(', '), 'utf8');
}

async function leaveChannelChat(client, joinChannels, reply, joinChannelsFilePath) {
	const joinChannel = reply.split(' ')[1];

	// remove @ if start with @
	if (joinChannel.startsWith('@')) {
		joinChannel = joinChannel.substring(1);
	}

	await client.part(joinChannel);
	const toRemove = myArray.indexOf(joinChannel);
	joinChannels.splice(toRemove, 1);
	fs.writeFileSync(joinChannelsFilePath, joinChannels.join(', '), 'utf8');
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
