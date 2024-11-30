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
const WebSocket = require('ws');

// webserver stuff
const express = require('express');
const http = require('http');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'views')));

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
	speechformat,
	redeemformat,
	trailingnum,
	acctoken,
	readredeems,
	readads,
	twitchid,
	wsport
} = require('./cred.js');
const { twitchsecret } = require('./twitchcred.js');

async function writeEnv() {
	const content = `USER=${user}
PASSWORD=${password}
READEMOTES=${reademotes}
IGNOREPREFIX=${ignoreprefix}
VOICE=${voice}
SPEED=${speed}
TRAILINGNUM=${trailingnum}
READREDEEMS=${readredeems}
READADS=${readads}
SPEECHFORMAT=${speechformat}
REDEEMFORMAT=${redeemformat}
ACCTOKEN=${acctoken}
TWITCHID=v9xn3jant9hwlkm89sf18no945kh7e
WSPORT=${wsport}`;
	const filePath = process.env.USERPROFILE + '/twitch-tts/.env'; // Specify the file path

	try {
		fs.writeFileSync(filePath, content);
		console.log('\n.env file written successfully!');
	} catch (err) {
		console.error('Error writing env file:', err);
	}
}

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

function convertMs(milliseconds) {
	let seconds = Math.round(milliseconds / 1000);
	let minutes = Math.floor(seconds / 60);
	let remainingSeconds = (seconds % 60).toFixed(0);

	return {
		minutes: minutes,
		remainingSeconds: remainingSeconds,
		totalSeconds: seconds.toFixed(0)
	};
}

async function downloadhtmlFile() {
	try {
		const response = await axios({
			url: 'https://github.com/Flamebullet/twitch-tts/releases/download/v1.1.0/index.html', // Replace with your file URL
			method: 'GET',
			responseType: 'stream' // Important: Set the response type to 'stream'
		});

		const writeStream = fs.createWriteStream(process.env.USERPROFILE + '/twitch-tts/index.html'); // Specify the local file path
		response.data.pipe(writeStream);

		await new Promise((resolve) => {
			writeStream.on('finish', resolve);
		});

		console.log('File download completed successfully. Restart program to start using.');
	} catch (error) {
		console.error('Error downloading file:', error.message);
		console.log(
			'You can try to manually download the file at https://github.com/Flamebullet/twitch-tts/releases/download/v1.1.0/index.html then place it in %USERPROFILE%/twitch-tts/ folder in windows'
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
	let lastSpeaker;
	const folderPath = process.env.USERPROFILE + '/twitch-tts';
	if (!fs.existsSync(folderPath)) {
		fs.mkdirSync(folderPath);
	}
	if (!fs.existsSync(process.env.USERPROFILE + '/twitch-tts/WinKeyServer.exe') || !fs.existsSync(process.env.USERPROFILE + '/twitch-tts/index.html')) {
		if (!fs.existsSync(process.env.USERPROFILE + '/twitch-tts/WinKeyServer.exe')) {
			console.log('Downloading WinKeyServer');
			await downloadFile();
		}
		if (!fs.existsSync(process.env.USERPROFILE + '/twitch-tts/index.html')) {
			console.log('Downloading index.html');
			await downloadhtmlFile();
		}
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

	const server = http.createServer(app);

	app.get('/', (req, res) => {
		const err = req.query.err ? req.query.err : null;

		return res.sendFile(process.env.USERPROFILE + '/twitch-tts/index.html', { err: err });
	});

	// Listener for POST requests
	app.post('/post', (req, res) => {
		acctoken = req.body.access_token;
		// Process the URL as needed (e.g., save to a database, perform some action)
		res.status(200).end();
		server.close(() => {
			setImmediate(() => {
				server.emit('close');
			});
		});
	});

	// Create .env file for initialisation
	if (user == undefined || password == undefined) {
		let reply = await questionPrompt('USERNAME(Enter twitch username): ');
		user = reply;

		reply = await questionPrompt('\nPASSWORD(NOT YOUR TWITCH ACCOUNT PASSWORD! Get your password here https://twitchapps.com/tmi/): ');
		password = reply;

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

		acctoken = '';
		// Start the server
		server.listen(port, () => {
			console.log(
				`\nAuthenticate your twitch account here https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=v9xn3jant9hwlkm89sf18no945kh7e&redirect_uri=http://localhost:3000&scope=channel%3Aread%3Aredemptions%20channel%3Aread%3Aads`
			);
		});

		while (acctoken == '') {
			await sleep(2000);
		}

		reply = await questionPrompt('\nDo you want to go though advanced setup?(y/n): ');
		if (reply.toLowerCase() == 'y') {
			reply = await questionPrompt('\nRead Emotes(1 for yes, 0 for no, recommended: 0): ');
			if (reply != 0 || reply != 1) reply = 0;
			reademotes = reply;

			reply = await questionPrompt('\nIgnore Prefix(1 for yes, 0 for no, recommended: 1): ');
			if (reply != 0 || reply != 1) reply = 1;
			ignoreprefix = reply;

			reply = await questionPrompt('\nTTS Speed(recommended: 1): ');
			if (reply <= 0) reply = 1;
			speed = reply;

			reply = await questionPrompt('\nSay trailing numbers in username(recommended: 1): ');
			if (reply != 0 || reply != 1) reply = 0;
			trailingnum = reply;

			reply = await questionPrompt('\nRead twitch redeems(recommended: 0): ');
			if (reply != 0 || reply != 1) reply = 0;
			readredeems = reply;

			reply = await questionPrompt('\nAlert upcoming ad break(recommended: 0): ');
			if (reply != 0 || reply != 1) reply = 0;
			readads = reply;

			reply = await questionPrompt('\nSpeech Format(Default: $username said $message): ');
			if (reply == '' || reply == undefined) reply = '$username said $message';
			speechformat = reply;

			reply = await questionPrompt('\nRedeem Format(Default: $username redeemed $redeem for $cost): ');
			if (reply == '' || reply == undefined) reply = '$username redeemed $redeem for $cost';
			redeemformat = reply;
		} else {
			reademotes = 0;
			ignoreprefix = 1;
			speed = 1;
			trailingnum = 1;
			readredeems = 0;
			readads = 0;
			speechformat = '$username said $message';
			redeemformat = '$username redeemed $redeem for $cost points';
		}
		wsport = 6970;

		writeEnv();
	}

	let nicknames;
	const nickJsonFilePath = process.env.USERPROFILE + '/twitch-tts/nicknames.json';
	if (fs.existsSync(nickJsonFilePath)) {
		nicknames = JSON.parse(fs.readFileSync(nickJsonFilePath));
	} else {
		fs.writeFileSync(nickJsonFilePath, JSON.stringify({}));
		nicknames = {};
	}

	let ignoreNames;
	const ignoreJsonFilePath = process.env.USERPROFILE + '/twitch-tts/ignore.json';
	if (fs.existsSync(ignoreJsonFilePath)) {
		ignoreNames = JSON.parse(fs.readFileSync(ignoreJsonFilePath));
	} else {
		fs.writeFileSync(ignoreJsonFilePath, JSON.stringify({}));
		ignoreNames = {};
	}

	let replacements;
	const replacementJsonFilePath = process.env.USERPROFILE + '/twitch-tts/replacement.json';
	if (fs.existsSync(replacementJsonFilePath)) {
		replacements = JSON.parse(fs.readFileSync(replacementJsonFilePath));
	} else {
		fs.writeFileSync(replacementJsonFilePath, JSON.stringify({}));
		replacements = {};
	}

	const credentials = new Credentials(acctoken, twitchid, twitchsecret);
	const authProvider = new AuthProvider(credentials);

	const TEclient = new EventSub(authProvider);
	TEclient.run();

	let result;
	while (true) {
		result = await axios({
			method: 'get',
			url: `https://api.twitch.tv/helix/users?login=${user}`,
			headers: {
				'Client-ID': twitchid,
				'Authorization': `Bearer ${await authProvider.getUserAccessToken()}`
			}
		}).catch(async (err) => {
			acctoken = '';
			// Start the server
			server.listen(port, () => {
				console.log(
					`\nAuthenticate your twitch account here https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=v9xn3jant9hwlkm89sf18no945kh7e&redirect_uri=http://localhost:3000&scope=channel%3Aread%3Aredemptions%20channel%3Aread%3Aads`
				);
			});

			while (acctoken == '') {
				await sleep(2000);
			}
			wsport = 6970;
			writeEnv();
		});
		if (result?.data?.data[0].id) break;
	}
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
		let jnchannels = fs.readFileSync(joinChannelsFilePath, 'utf8');
		if (jnchannels == '') {
			joinChannels = [];
		} else {
			joinChannels = jnchannels.split(', ');
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

	if (readads == true) {
		// On stream online, check for next ad break
		TEclient.register('streamOnline', {
			broadcaster_user_id: userId
		}).onTrigger(async (data) => {
			let timer = 0;
			while (true) {
				let result = await axios({
					method: 'get',
					url: `https://api.twitch.tv/helix/channels/ads?broadcaster_id=${userId}`,
					headers: {
						'Client-ID': twitchid,
						'Authorization': `Bearer ${await authProvider.getUserAccessToken()}`
					}
				});
				const nextAdTime = new Date(result.data.data[0].next_ad_at * 1000);

				if (!nextAdTime || nextAdTime < new Date(Date.now())) {
					timer = 60000;
				} else {
					const nextAdTimeInms = nextAdTime - new Date(Date.now());
					if (nextAdTimeInms < 300000) {
						// if ad break lesser than 5mins warn and check again in 1min
						const time = convertMs(nextAdTimeInms);
						let formatedmsg;

						if (time.totalSeconds < 60) {
							formatedmsg = `An ad break is starting in about ${time.totalSeconds} seconds`;
							console.log(`Channel: An ad break is starting in about ${time.totalSeconds}s.`);
						} else {
							formatedmsg = `An ad break is starting in about ${time.minutes} minutes ${time.remainingSeconds} seconds`;
							console.log(`Channel: An ad break is starting in about ${time.minutes}min ${time.remainingSeconds}s.`);
						}
						ttsQueue.push(formatedmsg);
						if (!currentlySpeaking) speak();
						timer = 60000;
					} else {
						// subtract 1mins from next adtime to get warning
						timer = nextAdTimeInms - 300000;
					}
				}
				await sleep(timer);
			}
		});

		TEclient.register('channelAdBreakBegin', {
			broadcaster_user_id: userId
		}).onTrigger(async (data) => {
			const formatedmsg = `An ad break of ${data.duration_seconds} seconds has begun`;
			console.log(`Channel: ${formatedmsg}`);

			ttsQueue.push(formatedmsg);
			if (!currentlySpeaking) speak();

			await sleep(data.duration_seconds * 1000);

			ttsQueue.push(`An ad break over`);
			if (!currentlySpeaking) speak();
		});
	}

	// client.on('cheer', async (channel, userstate, message) => {
	// 	const formatedmsg = `${userstate['display-name']} cheered ${userstate.bits}, ${message}`;
	// 	console.log(`Channel: ${formatedmsg}`);

	// 	ttsQueue.push(formatedmsg);
	// 	if (!currentlySpeaking) speak();
	// });

	const wss = new WebSocket.Server({ port: wsport });

	wss.on('connection', (ws, req) => {
		// Repeat the received message to twitch chat
		ws.on('message', (message) => {
			switch (req.url) {
				case '/message':
					console.log(`Message Received: ${message}`);

					client.say(user, `${message}`);
					break;
				case '/tts':
					console.log(`TTS Received: ${message}`);

					ttsQueue.push(message);
					if (!currentlySpeaking) speak();
					break;
			}
		});
	});

	console.log(`WebSocket server is listening on port ${wsport}`);

	client.on('message', async (channel, tags, message, self) => {
		//commands
		if (((tags.badges && tags.badges.broadcaster == '1') || tags.mod) && message.startsWith('!')) {
			if (message.toLowerCase() == '!ttsskip') {
				skipTTS();
				client.say(channel, `skipped!`);
			} else if (message.split(' ')[0] == '!ttsnick') {
				setNickname(nicknames, message, nickJsonFilePath);
				const words = message.split(' ');
				const nickname = words.slice(2).join(' ').toLowerCase();
				client.say(channel, `${tags.username} set ${message.split(' ')[1].toLowerCase()} to ${nickname}`);
			} else if (message.split(' ')[0] == '!ttsignore') {
				setIgnore(ignoreNames, message, ignoreJsonFilePath);
				client.say(channel, `${tags.username} ${message.split(' ')[1].toLowerCase()} ignored`);
			} else if (message.split(' ')[0] == '!ttsreplace') {
				setReplacement(replacements, message, replacementJsonFilePath);
				const words = message.split(' ');
				const replacement = words.slice(2).join(' ').toLowerCase();
				client.say(channel, `${tags.username} set ${message.split(' ')[1].toLowerCase()} to ${replacement}`);
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
		// Skip message from ignored
		if (tags.username.toLowerCase() in ignoreNames) return;

		let msg = message;
		// Remove emotes from messages if dont read emotes is selected
		if (!reademotes && tags.emotes) {
			msg = removeCharactersByRanges(msg, tags.emotes);
		}

		let username = tags.username;
		if (tags.username in nicknames) {
			username = nicknames[tags.username];
		} else if (tags.username && trailingnum == 0) {
			username = tags.username.replace(/\d+$/, '');
		}

		msg = msg.replace(/(\w+)/g, (match, key) => replacements[key] || match);

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
			} else if (reply.split(' ')[0] == '!ignore') {
				setIgnore(ignoreNames, reply, ignoreJsonFilePath);
			} else if (reply.split(' ')[0] == '!replace') {
				setReplacement(replacements, reply, replacementJsonFilePath);
			} else if (reply.split(' ')[0] == '!read') {
				let words = reply.split(' ');
				words.shift();
				say.speak(words.join(' '), voice, speed, (err) => {});
			} else if (reply.split(' ')[0] == '!voices') {
				voicesList = await getVoices();
				console.log(voicesList);
			} else if (reply.split(' ')[0] == '!reademotes') {
				if (reply.split(' ')[1] == 1 || reply.split(' ')[1] == 0) {
					reademotes = reply.split(' ')[1];
					writeEnv();
				}
			} else if (reply.split(' ')[0] == '!ignoreprefix') {
				if (reply.split(' ')[1] == 1 || reply.split(' ')[1] == 0) {
					ignoreprefix = reply.split(' ')[1];
					writeEnv();
				}
			} else if (reply.split(' ')[0] == '!speed') {
				if (!isNaN(reply.split(' ')[1])) {
					speed = reply.split(' ')[1];
					writeEnv();
				}
			} else if (reply.split(' ')[0] == '!trailingnum') {
				if (reply.split(' ')[1] == 1 || reply.split(' ')[1] == 0) {
					trailingnum = reply.split(' ')[1];
					writeEnv();
				}
			} else if (reply.split(' ')[0] == '!readredeems') {
				if (reply.split(' ')[1] == 1 || reply.split(' ')[1] == 0) {
					readredeems = reply.split(' ')[1];
					writeEnv();
				}
			} else if (reply.split(' ')[0] == '!readads') {
				if (reply.split(' ')[1] == 1 || reply.split(' ')[1] == 0) {
					readads = reply.split(' ')[1];
					writeEnv();
				}
			} else if (reply.split(' ')[0] == '!speechformat') {
				speechformat = reply.split(' ').slice(1).join(' ');
				writeEnv();
			} else if (reply.split(' ')[0] == '!redeemformat') {
				redeemformat = reply.split(' ').slice(1).join(' ');
				writeEnv();
			} else if (reply.split(' ')[0] == '!voice') {
				if (voicesList.indexOf(reply.split(' ').slice(1).join(' ')) === -1) reply = `Microsoft David Desktop`;
				voice = reply.split(' ').slice(1).join(' ');
				writeEnv();
			}
			commandPrompt();
		});
	}

	async function speak() {
		currentlySpeaking = true;
		while (ttsQueue.length > 0) {
			const ttsMsg = ttsQueue.shift();
			if (ttsMsg != '') {
				await tts(ttsMsg);
				await sleep(500);
			}
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
	let username = reply.split(' ')[1].toLowerCase();
	const words = reply.split(' ');
	const nickname = words.slice(2).join(' ').toLowerCase();

	// remove @ if start with @
	if (username.startsWith('@')) {
		username = username.substring(1);
	}

	nicknames[username] = nickname;

	fs.writeFileSync(nickJsonFilePath, JSON.stringify(nicknames));
	console.log(`Successfully set nickname for ${username} to ${nickname}`);
}

function setIgnore(ignoreNames, reply, ignoreJsonFilePath) {
	let username = reply.split(' ')[1].toLowerCase();

	// remove @ if start with @
	if (username.startsWith('@')) {
		username = username.substring(1);
	}

	if (username in ignoreNames) {
		delete ignoreNames[username];
		console.log(`Successfully removed ignore for ${username}`);
	} else {
		ignoreNames[username] = username;
		console.log(`Successfully set ignore for ${username}`);
	}

	fs.writeFileSync(ignoreJsonFilePath, JSON.stringify(ignoreNames));
}

function setReplacement(replacements, reply, replacementJsonFilePath) {
	const shortform = reply.split(' ')[1].toLowerCase();
	const words = reply.split(' ');
	const replacement = words.slice(2).join(' ').toLowerCase();

	replacements[shortform] = replacement;

	fs.writeFileSync(replacementJsonFilePath, JSON.stringify(replacements));
	console.log(`Successfully set replacement word from ${shortform} to ${replacement}`);
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
