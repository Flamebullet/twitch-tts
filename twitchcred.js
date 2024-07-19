const dotenv = require('dotenv');
dotenv.config();

module.exports = {
	twitchid: process.env.TWITCHID,
	twitchsecret: process.env.TWITCHSECRET
};
