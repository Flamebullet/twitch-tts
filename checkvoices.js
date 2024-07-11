const say = require('say');

function getVoices() {
	return new Promise((resolve) => {
		say.getInstalledVoices((err, voice) => {
			return resolve(voice);
		});
	});
}
async function usingVoices() {
	const voicesList = await getVoices();
	console.log(voicesList);
}
usingVoices();

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', process.exit.bind(process, 0));
