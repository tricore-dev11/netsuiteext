// OrderWizard.Module.Shipmethod.js
// --------------------------------
//
define('OrderWizard.Module.Shipmethod', ['Wizard.Module'], function (WizardModule)
{
	'use strict';

	return WizardModule.extend({

		template: 'order_wizard_shipmethod_module'

	,	events: {
			'click input[name="delivery-options"]': 'changeDeliveryOptions'
		}

	,	errors: ['ERR_CHK_SELECT_SHIPPING_METHOD','ERR_WS_INVALID_SHIPPING_METHOD']

	,	initialize: function (options)
		{
			this.waitShipmethod = SC.ENVIRONMENT.CART ? !SC.ENVIRONMENT.CART.shipmethod : !this.model.get('shipmethod');

			this.addresses = options.wizard.application.getUser().get('addresses');

			WizardModule.prototype.initialize.apply(this, arguments);
			// So we allways have a the reload promise
			this.reloadMethodsPromise = jQuery.Deferred().resolve();
		}

	,	present: function ()
		{
			this.currentAddress = this.previousAddress = this.model.get('shipaddress');
			this.eventHandlersOn();
		}

	,	future: function()
		{
			this.currentAddress = this.previousAddress = this.model.get('shipaddress');
			this.eventHandlersOn();
		}

	,	past: function()
		{
			this.waitShipmethod = !this.model.get('shipmethod');
			this.currentAddress = this.previousAddress = this.model.get('shipaddress');
			this.eventHandlersOn();
		}

	,	eventHandlersOn: function ()
		{
			// Removes any leftover observer
			this.eventHandlersOff();
			// Adds the observer for this step
			this.model.on('change:shipaddress', this.shipAddressChange, this);

			this.model.on('change:shipmethods', function(){
				_.defer(_.bind(this.render, this));
			}, this);

			var selected_address = this.addresses.get(this.currentAddress);

			if (selected_address)
			{
				selected_address.on('change:country change:zip', jQuery.proxy(this, 'reloadMethods'), this);
			}
		}

	,	eventHandlersOff: function ()
		{
			// removes observers
			this.model.off('change:shipmethods', null, this);
			this.model.off('change:shipaddress', this.shipAddressChange, this);

			var current_address = this.addresses.get(this.currentAddress)
			,	previous_address = this.addresses.get(this.previousAddress);

			if (current_address)
			{
				current_address.off('change:country change:zip', null, this);
			}

			if (previous_address && previous_address !== current_address)
			{
				previous_address.off('change:country change:zip', null, this);
			}
		}

	,	render: function ()
		{
			if (this.state === 'present')
			{
				if (this.model.get('shipmethod') && !this.waitShipmethod)
				{
					this.trigger('ready', true);
				}
				this._render();
			}
		}

	,	shipAddressChange: function (model, value)
		{
			// if its not null and there is a difference we reload the methods
			if (this.currentAddress !== value)
			{
				this.currentAddress = value;

				var order_address = this.model.get('addresses')
				,	previous_address = this.previousAddress && (order_address.get(this.previousAddress) || this.addresses.get(this.previousAddress))
				,	current_address = this.currentAddress && order_address.get(this.currentAddress) || this.addresses.get(this.currentAddress)
				,	changed_zip = previous_address && current_address && previous_address.get('zip') !== current_address.get('zip')
				,	changed_state = previous_address && current_address && previous_address.get('state') !== current_address.get('state')
				,	changed_country = previous_address && current_address && previous_address.get('country') !== current_address.get('country');

				// if previous address is equal to current address we compare the previous values on the model.
				if (this.previousAddress && this.currentAddress && this.previousAddress === this.currentAddress)
				{
					changed_zip = current_address.previous('zip') !== current_address.get('zip');
					changed_country = current_address.previous('country') !== current_address.get('country');
					changed_state = current_address.previous('state') !== current_address.get('state');
				}

				// reload ship methods only if there is no previous address or when change the country or zipcode
				if ((!previous_address && current_address) || changed_zip || changed_country || changed_state)
				{
					// if its selected a valid address, reload Methods
					if (this.model.get('isEstimating') || this.addresses.get(this.model.get('shipaddress')))
					{
						this.reloadMethods();
					}
				}
				else
				{
					this.render();
				}

				if (value)
				{
					this.previousAddress = value;
				}
			}
		}

	,	reloadMethods: function ()
		{
			// to reload the shipping methods we just save the order
			var self = this
			,	$container = this.$el;

			$container.addClass('loading');

			// Abort the previous ajax call
			this.reloadMethodsPromise.abort && this.reloadMethodsPromise.abort();
			this.reloadingMethods = true;
			this.reloadMethodsPromise = this.model.save(null, {
				parse: false
			,	success: function (model, attributes)
				{
					model.set({
							shipmethods: attributes.shipmethods
						,	summary: attributes.summary
					});
				}
			}).always(function (xhr)
			{
				// .always() method is excecuted even if the ajax call was aborted
				if (xhr.statusText !== 'abort')
				{
					$container.removeClass('loading');
					self.render();
					self.step.enableNavButtons();
					self.reloadingMethods = false;
				}
			});

			if (this.reloadMethodsPromise.state() === 'pending')
			{
				self.step.disableNavButtons();
			}
		}

	,	submit: function ()
		{
			if (!this.reloadingMethods)
			{
				this.model.set('shipmethod', this.$('input[name=delivery-options]:checked').val());
			}
			return this.isValid();
		}

	,	isValid: function ()
		{
			var model = this.model
			,	valid_promise = jQuery.Deferred();

			this.reloadMethodsPromise.always(function ()
			{
				if (model.get('shipmethod') && model.get('shipmethods').get(model.get('shipmethod')))
				{
					valid_promise.resolve();
				}
				else
				{
					valid_promise.reject({
						errorCode: 'ERR_CHK_SELECT_SHIPPING_METHOD'
					,	errorMessage: _('Please select a shipping method').translate()
					});
				}
			});

			return valid_promise;
		}

	,	changeDeliveryOptions: function (e)
		{
			var self = this;

			this.waitShipmethod = true;

			this.model.set('shipmethod', this.$(e.target).val());
			this.step.disableNavButtons();
			this.model.save().always(function()
			{
				self.clearError();
				self.step.enableNavButtons();
			});
		}

		// render the error message
	,	showError: function ()
		{
			// Note: in special situations (like in payment-selector), there are modules inside modules, so we have several place holders, so we only want to show the error in the first place holder.
			this.$('[data-type="alert-placeholder-module"]:first').html(
				SC.macros.message(this.error.errorMessage, 'error', true)
			);
		}
	});
});
