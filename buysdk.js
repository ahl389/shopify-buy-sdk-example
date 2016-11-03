$(function() {

	/* Build new ShopifyBuy client
	============================================================ */
	var client = ShopifyBuy.buildClient({
		apiKey: '248b922aeaee15d33c44aa3e657663f6', // Your SDK API/access token 
		domain: 'stickers-15.myshopify.com', // Your complete Shopify store domain
		appId: '6'
	});

	var product;
	var cart;
	var cartLineItemCount;
	
	//grab collection ID from div.collection#collection-id in HTML
	var collectionID = $('body').find('.collection').attr('id');
	
	// check for existing cart in local storage, if one doesn't exist
	// create new cart object
	if(localStorage.getItem('lastCartId')) {
		client.fetchCart(localStorage.getItem('lastCartId')).then(function(remoteCart) {
			cart = remoteCart;
			cartLineItemCount = cart.lineItems.length;
			renderCartItems();
		});
	} else {
		client.createCart().then(function (newCart) {
			cart = newCart;
			localStorage.setItem('lastCartId', cart.id);
			cartLineItemCount = 0;
		});
	}

	var previousFocusItem;


  	/* Fetch products in collection and loop through to create HTML for each product
  	======================================================================== */
	client.fetchQueryProducts({collection_id: collectionID, sort_by: 'collection-default' }).then(function(products) {
		
		// Products ==  the array of products within the collection
		for (i = 0; i < products.length; i++) {
			product = products[i];
			var productHTML = 	'<div class="product" id="buy-button-'+i+'" data-product-id = "'+ product.id+'">'+
									'<div class = "image-overlay-container">' +
										'<img class="variant-image pointer">'+
										'<div class = "image-overlay pointer"></div>' +
									'</div>' +
								  	'<div class = "product-details">'+
										'<h1 class="product-title pointer"></h1>'+
										'<h2 class="variant-title pointer"></h2>'+
										'<h2 class="variant-price"></h2>'+
								  	'</div>'+
									'<div class = "product-modal">'+
										'<div class = "modal-left"><img class="variant-image"></div>'+
										'<div class = "modal-right">'+
				   							'<h1 class="product-title"></h1>'+	
				   							'<h2 class="variant-title"></h2>'+
											'<h2 class="variant-price"></h2>'+
											'<div class = "product-description"></div>'+
					  						'<div class="variant-selectors"></div>'+
										'</div>'+
										'<div style = "clear:both"></div>'+'<i class="fa fa-times fa-2x product-modal-close" aria-hidden="true"></i>'+
										'<div class = "button-container">'+
											'<button class="btn buy-button js-prevent-cart-listener add-button" data-product-id = "'+product.id+'" data-variant-id = "'+ product.selectedVariant.id+'">Add To Cart</button>'+
									    '</div>'+
								   '</div>'+
								'</div>';
				
				
			$('.collection').append(productHTML);
			
			var selectedVariant = product.selectedVariant;
			var selectedVariantImage = product.selectedVariantImage;
			var varCount = product.variants.length;
			
			if (varCount > 1) {
				var variantSelectors = generateSelectors(i, product.variants);
				updateVariantSelectors(i, variantSelectors);
				updateVariantTitle(i, selectedVariant);
			}

			updateProductTitle(i, product.title);
			updateProductDescription(i, product.description);
			updateVariantImage(i, selectedVariantImage);
			updateVariantPrice(i, selectedVariant);
		}
		
		updateCartTabButton();
		bindEventListeners();
		attachOnVariantSelectListeners();
		updateCollectionTitle();
	});
	
	
	
  	/* Bind Event Listeners
  	============================================================ */
	function bindEventListeners() {
		
		// cart close button listener 
		$('.cart .btn--close').on('click', closeCart);

		// click away listener to close cart 
		$(document).on('click', function(evt) {
			if((!$(evt.target).closest('.cart').length) && (!$(evt.target).closest('.js-prevent-cart-listener').length)) {
				closeCart();
			}
		});

		// escape key handler 
		var ESCAPE_KEYCODE = 27;
		$(document).on('keydown', function (evt) {
			if (evt.which === ESCAPE_KEYCODE) {
				if (previousFocusItem) {
					$(previousFocusItem).focus();
					previousFocusItem = ''
				}
				closeCart();
			}
		});

		// checkout button click listener 
		$('.btn--cart-checkout').on('click', function () {
			var checkoutURL = cart.checkoutUrl;
			// if ($('input.cartAttribute').is(':checked')) {
			// 	var val = $('input.cartAttribute').val();
			// 	checkoutURL += '&attributes[ATTRIBUTE NAME]=' + val;
			// }
			window.open(checkoutURL, '_self');
		});


		// buy button click listener 
		$('.buy-button').on('click', buyButtonClickHandler);

		// increment quantity click listener 
		$('.cart').on('click', '.quantity-increment', function () {
			var variantId = $(this).data('variant-id');
			incrementQuantity(variantId);
		});

		// decrement quantity click listener 
		$('.cart').on('click', '.quantity-decrement', function() {
			var variantId = $(this).data('variant-id');
			decrementQuantity(variantId);
		});

		// update quantity field listener 
		$('.cart').on('keyup', '.cart-item__quantity', debounce(fieldQuantityHandler, 250));

		// cart tab click listener 
		$('.btn--cart-tab').click(function() {
			setPreviousFocusItem(this);
			openCart();
		});
		
		// open product modal
		$('.collection').on('click', '.image-overlay, .variant-image, .product-details', function(){
			console.log('clicked');
			$(this).parents('.product').find('.product-modal').show();
			if (!$('.product-modal-underlay').length) {
				$('body').append('<div class = "product-modal-underlay"></div>');
			}
		});
		
		// close product modal
		$('body').on('click', '.product-modal-underlay, .product-modal-close', hideModal);

	}
	
 	/* Attach and control listeners onto buy button
  	============================================================ */
	function buyButtonClickHandler(evt) {
	
		evt.preventDefault();
		var productID = $(this).attr('data-product-id');
		var variantID = $(this).attr('data-variant-id'); 
		var cartLineItem = findCartItemByVariantId(variantID);
		var quantity = cartLineItem ? cartLineItem.quantity + 1 : 1;
		
		client.fetchProduct(productID).then(function(product) {
		 	for (var i = 0; i < product.variants.length; i++) {
		 		if (product.variants[i].id == variantID) {
		 			variantObject = product.variants[i];
					addOrUpdateVariant(cartLineItem, variantObject, quantity);
					setPreviousFocusItem(evt.target);
					$('#checkout').focus();
		 		}
		 	}
		});
	}

  	/* Generate DOM elements for variant selectors
  	============================================================ */
	function generateSelectors(num, variants) {
		var options;

		for (var i = 0; i < variants.length; i++) {
			options += '<option value = "' + variants[i].id + '">' + variants[i].title + '</option>';
		}

		return 	'<select name = "variant-selection" class = "product' + num + '">' + options + '</select>';
	}

  	/* Variant option change handler
  	============================================================ */
	function attachOnVariantSelectListeners() {
		$('.collection').on('change', 'select[name=variant-selection]', function(event) {
			var element = $(this);
			var num = element.attr('class').replace("product", "");
			var productID = element.closest('.product').attr('data-product-id');
			var variantID = element.val();
			var variantName = element.find('option:selected').text();
			
			$('.add-button[data-product-id="'+ productID +'"]').attr('data-variant-id', variantID)
			
			client.fetchProduct(productID).then(function(product) {
			 	for (var i = 0; i < product.variants.length; i++) {
			 		if (product.variants[i].id == variantID) {
			 			var selectedVariant = product.variants[i];
						updateVariantImage(num, selectedVariant.image);
						updateVariantTitle(num, selectedVariant);
						updateVariantPrice(num, selectedVariant);
			 		}
			 	}
			});
		});
	}
	

	
	/* Update collection title
	/*************************************************************/
	function updateCollectionTitle() {
		client.fetchCollection(collectionID).then(function(collection) {
			var collectionTitle = collection.attrs.title;
			$('h2.collection-title').text(collectionTitle);
		});
	}
	

	/* Update product title
	============================================================ */
	function updateProductTitle(i, title) {
		$('#buy-button-'+i).find('.product-title').text(title);
	}

	/* Update product description
	============================================================ */
	function updateProductDescription(i, description) {
		$('#buy-button-'+i).find('.product-description').html(description);
	}

	/* Update product image based on selected variant
	============================================================ */
	function updateVariantImage(i, image) {
		var src = (image) ? image.src : ShopifyBuy.NO_IMAGE_URI;
		$('#buy-button-'+i).find('.variant-image').attr('src', src);
	}

	/* Update product variant title based on selected variant
	============================================================ */
	function updateVariantTitle(i, variant) {
		$('#buy-button-'+i).find('.variant-title').text(variant.title);
	}

	/* Update product variant price based on selected variant
	============================================================ */
	function updateVariantPrice(i, variant) {
		$('#buy-button-'+i).find('.variant-price').text('$' + variant.price);
	}

	/* Update product variant selectors 
	============================================================ */
	function updateVariantSelectors(i, variantSelectors) {
		$('#buy-button-'+i).find('.variant-selectors').html(variantSelectors);
	}
  

	
	
	/*************************************************************/
	
	
	
	
	/* Decrease quantity amount by 1
	============================================================ */
	function decrementQuantity(variantId) {
		updateQuantity(function(quantity) {
			return quantity - 1;
		}, variantId);
	}

	/* Increase quantity amount by 1
	============================================================ */
	function incrementQuantity(variantId) {
		updateQuantity(function(quantity) {
			return quantity + 1;
		}, variantId);
	}

	/* Update product variant quantity in cart
	============================================================ */
	function updateQuantity(fn, variantId) {
		var quantity;
		var cartLineItem = findCartItemByVariantId(variantId);
		if (cartLineItem) {
			quantity = fn(cartLineItem.quantity);
			updateVariantInCart(cartLineItem, quantity);
		}
	}

	/* Update product variant quantity in cart through input field
	============================================================ */
	function fieldQuantityHandler(evt) {
		var variantId = parseInt($(this).closest('.cart-item').attr('data-variant-id'), 10);
		var cartLineItem = findCartItemByVariantId(variantId);
		var quantity = evt.target.value;
		if (cartLineItem) {
			updateVariantInCart(cartLineItem, quantity);
		}
	}

	/* Debounce taken from _.js
	============================================================ */
	function debounce(func, wait, immediate) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			var later = function() {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		}
	}


	
	
	/*************************************************************/



	/* Hide Modal 
	============================================================ */
	function hideModal() {
		$('.product-modal').hide();
		$('.product-modal-underlay').remove();
	}
	
	
	/* Open Cart
	============================================================ */
	function openCart() {
		$('.cart').addClass('js-active');
		hideModal();
	}

	/* Close Cart
	============================================================ */
	function closeCart() {
		$('.cart').removeClass('js-active');
		$('.overlay').removeClass('js-active');
	}

	/* Find Cart Line Item By Variant Id
	============================================================ */
	function findCartItemByVariantId(variantId) {
		return cart.lineItems.filter(function(item) {
			return (item.variant_id == variantId);
		})[0];
	}

  	/* Determine action for variant adding/updating/removing
  	============================================================ */
	function addOrUpdateVariant(cartLineItem, variantObject, quantity) {
		openCart();
		var variantObjectID = variantObject.id;
		if (cartLineItem) {
			updateVariantInCart(cartLineItem, quantity);
		} else {
			addVariantToCart(variantObject, quantity);
		}
		updateCartTabButton();
	}

  	/* Update details for item already in cart. Remove if necessary
  	============================================================ */
	function updateVariantInCart(cartLineItem, quantity) {
		var variantId = cartLineItem.variant_id;
		var cartLength = cart.lineItems.length;
		cart.updateLineItem(cartLineItem.id, quantity).then(function(updatedCart) {
			var $cartItem = $('.cart').find('.cart-item[data-variant-id="' + variantId + '"]');
			
			if (updatedCart.lineItems.length >= cartLength) {
					$cartItem.find('.cart-item__quantity').val(cartLineItem.quantity);
					$cartItem.find('.cart-item__price').text(formatAsMoney(cartLineItem.line_price));
			} else {
				$cartItem.addClass('js-hidden').bind('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function() {
				   $cartItem.remove();
				});
			}

			updateCartTabButton();
			updateTotalCartPricing();
			
			if (updatedCart.lineItems.length < 1) {
				closeCart();
			}
		}).catch(function (errors) {
			console.log('Fail');
			console.error(errors);
		});
	}

  	/* Add 'quantity' amount of product 'variant' to cart
  	============================================================ */
	function addVariantToCart(variantObject, quantity) {
		openCart();
		var lineItems = $('<div class = "lineItems"></div>');
		cart.addVariants({ variant: variantObject, quantity: quantity }).then(function(cart) {
			for (var i = 0; i < cart.lineItems.length; i++) {
				lineItems.append(renderCartItem(cart.lineItems[i]));
			}

			var $cartItemContainer = $('.cart-item-container');
			$cartItemContainer.empty();
			$cartItemContainer.append(lineItems);
		}).catch(function (errors) {
			console.log('Fail');
			console.error(errors);
		});

		updateTotalCartPricing();
		updateCartTabButton();
	}
	
	/* Update cart tab button
	============================================================ */
	function updateCartTabButton() {
		if (cart.lineItems.length > 0) {
			$('.btn--cart-tab .btn__counter').html(cart.lineItemCount);
			$('.btn--cart-tab').addClass('js-active');
		} else {
			$('.btn--cart-tab').removeClass('js-active');
			$('.cart').removeClass('js-active');
		}
	}

  	/* Return required markup for single item rendering
  	============================================================ */
	function renderCartItem(lineItem) {
		console.log(lineItem);
		var lineItemEmptyTemplate = $('#CartItemTemplate').html();
		var $lineItemTemplate = $(lineItemEmptyTemplate);
		var itemImage = lineItem.image.src;
		
		$lineItemTemplate.attr('data-variant-id', lineItem.variant_id);
		$lineItemTemplate.addClass('js-hidden');
		$lineItemTemplate.find('.cart-item__img').css('background-image', 'url(' + itemImage + ')');
		$lineItemTemplate.find('.cart-item__title').text(lineItem.title);
		
		if (lineItem.variant_title != 'Default Title') {
			$lineItemTemplate.find('.cart-item__variant-title').text(lineItem.variant_title);
		}

		$lineItemTemplate.find('.cart-item__price').text(formatAsMoney(lineItem.line_price));
		$lineItemTemplate.find('.cart-item__quantity').attr('value', lineItem.quantity);
		$lineItemTemplate.find('.quantity-decrement').attr('data-variant-id', lineItem.variant_id);
		$lineItemTemplate.find('.quantity-increment').attr('data-variant-id', lineItem.variant_id);
		$lineItemTemplate.removeClass('js-hidden');

		return $lineItemTemplate;
	}

 	/* Render the line items currently in the cart
  	============================================================ */
	function renderCartItems() {
		var $cartItemContainer = $('.cart-item-container');
		$cartItemContainer.empty();
		
		var lineItemEmptyTemplate = $('#CartItemTemplate').html();
		var $cartLineItems = cart.lineItems.map(function (lineItem, index) {
			return renderCartItem(lineItem);
		});
		
		$cartItemContainer.append($cartLineItems);

		setTimeout(function() {
			$cartItemContainer.find('.js-hidden').removeClass('js-hidden');
		}, 0);
		updateTotalCartPricing();
	}

	/* Update Total Cart Pricing
	============================================================ */
	function updateTotalCartPricing() {
		$('.cart .pricing').text(formatAsMoney(cart.subtotal));
	}

	/* Format amount as currency
	============================================================ */
	function formatAsMoney(amount, currency, thousandSeparator, decimalSeparator, localeDecimalSeparator) {
		currency = currency || '$';
		thousandSeparator = thousandSeparator || ',';
		decimalSeparator = decimalSeparator || '.';
		localeDecimalSeparator = localeDecimalSeparator || '.';
		var regex = new RegExp('(\\d)(?=(\\d{3})+\\.)', 'g');

		return currency + parseFloat(amount, 10).toFixed(2)
			.replace(localeDecimalSeparator, decimalSeparator)
			.replace(regex, '$1' + thousandSeparator)
		.toString();
	}

	/* Set previously focused item for escape handler
	============================================================ */
	function setPreviousFocusItem(item) {
		previousFocusItem = item;
	}

});