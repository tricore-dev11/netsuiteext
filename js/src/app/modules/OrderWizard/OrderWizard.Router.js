// OrderWizzard.Router.js
// ----------------------
//
define('OrderWizard.Router', ['Wizard.Router', 'OrderWizard.Step', 'Order.Model'], function (WizardRouter, OrderWizardStep, OrderModel)
{
	'use strict';

	return WizardRouter.extend({

		step: OrderWizardStep

	,	initialize: function()
		{
			WizardRouter.prototype.initialize.apply(this, arguments);

			if (this.application.getConfig('startCheckoutWizard') && !~_.indexOf(this.stepsOrder, ''))
			{
				this.route('', 'startWizard');
				this.route('?:options', 'startWizard');
			}
		}

	,	startWizard: function()
		{
			Backbone.history.navigate(this.getFirstStepUrl(), {trigger: true, replace:true});
		}

	,	hidePayment: function()
		{
			return this.application.getConfig('siteSettings.checkout.hidepaymentpagewhennobalance') === 'T' && this.model.get('summary').total === 0;
		}

	,	isPaypal: function()
		{
			var selected_paymentmethod = this.model.get('paymentmethods').findWhere({primary: true});
			return selected_paymentmethod && selected_paymentmethod.get('type') === 'paypal';
		}

		//Checks if the shipping address is require and if all items in the order are nonshippable.
		//If the order only contains non shippable items and shipping address is not require, the shipping address is removed
	,	checkIfShippingAddressIsRequired: function (dont_unset_address)
		{
			var common_is_active = this.model.getIfThereAreDeliverableItems() || this.application.getConfig('siteSettings.requireshippinginformation', 'F') === 'T';
			if (!common_is_active && !dont_unset_address)
			{
				this.model.unset('shipaddress', {silent: true});
			}
			return common_is_active;
		}

	,	isPaypalComplete: function()
		{
			var selected_paymentmethod = this.model.get('paymentmethods').findWhere({primary: true});
			return selected_paymentmethod && selected_paymentmethod.get('type') === 'paypal' && selected_paymentmethod.get('complete');
		}

	,	runStep: function(options)
		{
			// Computes the position of the user in the flow
			var url = (options) ? Backbone.history.fragment.replace('?' + options, '') : Backbone.history.fragment
			,	position = this.getStepPosition(url)
			,	layout = this.application.getLayout()
			,	content = ''
			,	page_header = ''
			,	last_order_id = options && ~options.indexOf('last_order_id=');

			if (last_order_id || !this.application.getCart().getTotalItemCount())
			{
				if(this.application.getUser().get('isGuest') !== 'T' && last_order_id)
				{
					//checkout just finnished and user refreshed the doc.
					var orderId = options.substring(options.indexOf('last_order_id=') + 'last_order_id='.length, options.length);
					page_header = _('Your Order has been placed').translate();
					content += _('If you want to review your last order you can go to <a href="#" data-touchpoint="$(0)" data-hashtag="#/ordershistory/view/$(1)">Your Account</a>. ')
						.translate('customercenter', orderId) +
						_('Or you can continue Shopping on our <a href="/" data-touchpoint="home">Home Page</a>. ').translate();
				}
				else
				{
					page_header = _('Your Shopping Cart is empty').translate();
					content = _('Continue Shopping on our <a href="/" data-touchpoint="home">Home Page</a>. ').translate();
				}

				return this.application.getLayout().internalError(content, page_header, _('Checkout').translate());
			}

			// if you have already placed the order you can not be in any other step than the last
			if (this.model && this.model.get('confirmation') && this.model.get('confirmation').confirmationnumber && position.toLast !== 0)
			{
				window.location = this.application.getConfig('siteSettings.touchpoints.home');
				return;
			}

			WizardRouter.prototype.runStep.apply(this, arguments);

			// if you are in the last step we are going to clear your minicart
			if (position.toLast === 0)
			{
				layout.$(layout.key_elements.miniCart).html(SC.macros.miniCart(new OrderModel(), this.application));
				layout.$(layout.key_elements.miniCartSummary).html(SC.macros.miniCartSummary(0));
			}
		}
	});
});
