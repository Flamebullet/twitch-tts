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

// webserver stuff
const express = require('express');
const http = require('http');
const path = require('path');
const app = express();
const port = 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.json());

// twitch evensub stuff
const { EventSub } = require('@twapi/eventsub');
const { Credentials, AuthProvider } = require('@twapi/auth');

function questionPrompt(q) {
	return new Promise((resolve, reject) => {
		rl.question(q, (userInput) => {
			resolve(userInput);
		});
	});
}

let {
	user,
	password,
	reademotes,
	ignoreprefix,
	voice,
	speed,
	ignoreself,
	speechformat,
	redeemformat,
	trailingnum,
	acctoken,
	readredeems
} = require('./cred.js');
const { twitchid, twitchsecret } = require('./twitchcred.js');

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

function tts(text) {
	return new Promise((resolve, reject) => {
		say.speak(text, voice, speed, (err) => {
			if (err) {
				reject(console.error(err));
			}

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

	function getVoices() {
		return new Promise((resolve) => {
			say.getInstalledVoices((err, voice) => {
				return resolve(voice);
			});
		});
	}

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
		async function usingVoices() {
			voicesList = await getVoices();
			console.log(
				`\n\nList of available voices: ${voicesList} \n\nCheck out the following link to download more: https://support.microsoft.com/en-gb/topic/download-languages-and-voices-for-immersive-reader-read-mode-and-read-aloud-4c83a8d8-7486-42f7-8e46-2b0fdf753130`
			);
		}
		await usingVoices();
		reply = await questionPrompt('\nTTS Voice(Preinstalled voices are Microsoft David Desktop (Male) and Microsoft Zira Desktop (Female):');
		if (voicesList.indexOf(reply) === -1) reply = `Microsoft David Desktop`;
		voice = reply;

		reply = await questionPrompt('\nTTS Speed(recommended: 1): ');
		if (reply <= 0) reply = 1;
		speed = reply;

		reply = await questionPrompt('\nIgnore own message(recommended: 1): ');
		if (reply != 0 || reply != 1) reply = 1;
		ignoreself = reply;

		reply = await questionPrompt('\nSay trailing numbers in username(recommended: 0): ');
		if (reply != 0 || reply != 1) reply = 0;
		trailingnum = reply;

		reply = await questionPrompt('\nRead twitch redeems(recommended: 0): ');
		if (reply != 0 || reply != 1) reply = 0;
		readredeems = reply;

		reply = await questionPrompt('\nSpeech Format(Default: $username said $message): ');
		if (reply == '' || reply == undefined) reply = '$username said $message';
		speechformat = reply;

		reply = await questionPrompt('\nRedeem Format(Default: $username redeemed $redeem for $cost): ');
		if (reply == '' || reply == undefined) reply = '$username redeemed $redeem for $cost';
		redeemformat = reply;

		let accToken = '';
		const server = http.createServer(app);
		// Start the server
		server.listen(port, () => {
			console.log(
				`\nAuthenticate your twitch account here https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=v9xn3jant9hwlkm89sf18no945kh7e&redirect_uri=http://localhost:3000&scope=channel%3Aread%3Aredemptions`
			);
		});

		app.get('/', (req, res) => {
			const err = req.query.err ? req.query.err : null;

			return res.render('index', { err: err });
		});

		// Listener for POST requests
		app.post('/post', (req, res) => {
			accToken = req.body.access_token;
			// Process the URL as needed (e.g., save to a database, perform some action)
			res.status(200).end();
			server.close(() => {
				setImmediate(() => {
					server.emit('close');
				});
			});
		});

		while (accToken == '') {
			await sleep(2000);
		}

		const content = `USER=${user}
PASSWORD=${password}
READEMOTES=${reademotes}
IGNOREPREFIX=${ignoreprefix}
VOICE=${voice}
SPEED=${speed}
IGNORESELF=${ignoreself}
TRAILINGNUM=${trailingnum}
READREDEEMS=${readredeems}
SPEECHFORMAT=${speechformat}
REDEEMFORMAT=${redeemformat}
ACCTOKEN=${accToken}`;
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

	const credentials = new Credentials(acctoken, twitchid, twitchsecret);
	const authProvider = new AuthProvider(credentials);

	const TEclient = new EventSub(authProvider);
	TEclient.run();

	const result = await axios({
		method: 'get',
		url: `https://api.twitch.tv/helix/users?login=${user}`,
		headers: {
			'Client-ID': twitchid,
			'Authorization': `Bearer ${await authProvider.getUserAccessToken()}`
		}
	});
	let userId = result.data.data[0].id;

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

	if (readredeems == true) {
		TEclient.register('channelPointsCustomRewardRedemptionAdd', {
			broadcaster_user_id: userId
		}).onTrigger(async (data) => {
			let username = data.user_login;
			if (username in nicknames) {
				username = nicknames[username];
			} else if (username && !trailingnum) {
				username = username.replace(/\d+$/, '');
			}

			const formatedmsg = redeemformat.replace('$username', username).replace('$redeem', data.reward.title).replace('$cost', data.reward.cost);
			console.log(`${username} redeemed ${data.reward.title} for ${data.reward.cost} channel points`);

			ttsQueue.push(formatedmsg);

			if (!currentlySpeaking) speak();
		});
	}

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
		} else if (tags.username && !trailingnum) {
			username = tags.username.replace(/\d+$/, '');
		}

		const formatedmsg = speechformat.replace('$username', username).replace('$message', msg);

		ttsQueue.push(formatedmsg);

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
			} else if (reply.split(' ')[0] == '!read') {
				let words = reply.split(' ');
				words.shift();
				say.speak(words.join(' '), voice, speed, (err) => {});
			} else if (reply.split(' ')[0] == '!voices') {
				voicesList = await getVoices();
				console.log(voicesList);
			}
			commandPrompt();
		});
	}

	async function speak() {
		currentlySpeaking = true;
		while (ttsQueue.length > 0) {
			const ttsMsg = ttsQueue.shift();
			await tts(ttsMsg);
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
	const toRemove = joinChannels.indexOf(joinChannel);
	joinChannels.splice(toRemove, 1);
	fs.writeFileSync(joinChannelsFilePath, joinChannels.join(', '), 'utf8');
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
