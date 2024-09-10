var renderTime = function () {
	var time = new Date();
	clock.textContent = time.toLocaleString('de-DE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: 'numeric', hour12: false});
};
setInterval(renderTime, 1000);