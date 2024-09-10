var renderTime = function () {
	var time = new Date();
	clock.textContent = time.toLocaleString('de-DE', {year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false});
};
setInterval(renderTime, 1000);