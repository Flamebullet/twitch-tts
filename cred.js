const dotenv = require('dotenv');
dotenv.config({ path: process.env.USERPROFILE + '/twitch-tts/.env' });

module.exports = {
	user: process.env.USER,
	password: process.env.PASSWORD,
	reademotes: !!+process.env.READEMOTES,
	ignoreprefix: !!+process.env.IGNOREPREFIX,
	voice: process.env.VOICE,
	speed: process.env.SPEED,
	ignoreself: process.env.IGNORESELF,
	trailingnum: process.env.TRAILINGNUM,
	readredeems: process.env.READREDEEMS,
	readads: process.env.READADS,
	speechformat: process.env.SPEECHFORMAT,
	redeemformat: process.env.REDEEMFORMAT,
	acctoken: process.env.ACCTOKEN,
	twitchid: process.env.TWITCHID,
	wsport: process.env.WSPORT
};
