var renderTime = function () {
	const time = new Date();
	const timeString =  time.toLocaleString(
		'de-DE', 
		{
			year: 'numeric', 
			month: '2-digit', 
			day: '2-digit', 
			hour: '2-digit', 
			minute: '2-digit', 
			second: 'numeric', 
			hour12: false
		},
	);

	let part1 = timeString.substring(0, 9);
	let part2 = timeString.substring(9, 18);
	let part3 = timeString.substring(18);

	clock.textContent = `${part1}.${part2}:${part3}`;
};
setInterval(renderTime, 1000);