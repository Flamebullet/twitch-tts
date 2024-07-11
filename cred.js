const dotenv = require('dotenv');
dotenv.config();

module.exports = {
	user: process.env.USER,
	password: process.env.PASSWORD,
	reademotes: !!+process.env.READEMOTES,
	ignoreprefix: !!+process.env.IGNOREPREFIX,
	voice: process.env.VOICE,
	speed: process.env.SPEED
};
