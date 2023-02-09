$(document).ready(function(){

	(function($) {
		var docElem = document.documentElement,
				$header = $('header.header'),
				didScroll = false,
				changeHeaderOn = 300;

		$('#header-icon').click(function(e){
			e.preventDefault();
			$('body').toggleClass('with--sidebar');
		});
    
    $('#site-cache').click(function(e){
      $('body').removeClass('with--sidebar');
		});

		
		function init() {
			window.addEventListener('scroll', function(event) {
				if(!didScroll) {
					window.requestAnimationFrame(function() {
						didScroll = true;
						setTimeout(scrollPage, 250);
					});
				}
			}, false);
			shrinkHeader(2500);
		}

		function scrollPage() {
			var sy = scrollY();
			if(sy >= changeHeaderOn) {
				$header.addClass('header-shrink');
			} else {
				$header.removeClass('header-shrink');
				shrinkHeader(2500);
			}
			didScroll = false;
		}

		function scrollY() {
			return window.pageYOffset || docElem.scrollTop;
		}

		function shrinkHeader(delay) {
			setTimeout(function() {
				if(!$header.hasClass('header-shrink')) {
					$header.addClass('header-shrink');
				}
			}, delay);
		}

		init();
	})(jQuery);

});