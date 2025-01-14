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

  clock.textContent = `${timeString}`;
};
setInterval(renderTime, 1000);
