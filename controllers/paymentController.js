import { catchAsyncErrors } from '../utils/catch-async-error.js';
import Stripe from 'stripe';
import { throwError } from '../utils/throw-error.js';
import User from '../model/User.js';

if (!process.env.STRIPE_SECRET_KEY) {
	throw new Error('Missing Stripe secret key');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const plans = [
	{
		name: 'Regular Tier 1',
		price: 0,
		role: 'regular',
		jobLimit: 1,
		visibilityDays: 10,
		canTop: false,
		price_id: 'price_regular_tier1_free',
	},
	{
		name: 'Regular Tier 2',
		price: 19,
		role: 'regular',
		jobLimit: 2,
		visibilityDays: 30,
		canTop: false,
		price_id: 'price_regular_tier2_19eur',
	},
	{
		name: 'Regular Tier 3',
		price: 59,
		role: 'regular',
		jobLimit: 3,
		visibilityDays: 30,
		canTop: true,
		topDays: 30,
		price_id: 'price_regular_tier3_59eur',
	},
	// Company Role Plans
	{
		name: 'Company Tier 1',
		price: 0,
		role: 'company',
		jobLimit: 1,
		visibilityDays: 10,
		canTop: false,
		price_id: 'price_company_tier1_free',
	},
	{
		name: 'Company Tier 2',
		price: 59,
		role: 'company',
		jobLimit: 2,
		visibilityDays: 30,
		canTop: false,
		price_id: 'price_company_tier2_59eur',
	},
	{
		name: 'Company Tier 3',
		price: 99,
		role: 'company',
		jobLimit: 5,
		visibilityDays: 30,
		canTop: true,
		topDays: 7,
		price_id: 'price_company_tier3_99eur',
	},
	{
		name: 'Company Tier 4',
		price: 179,
		role: 'company',
		jobLimit: 10,
		visibilityDays: 40,
		canTop: true,
		topDays: 14,
		price_id: 'price_company_tier4_179eur',
	},
];

export const getPlanForPriceId = (priceId) => {
	return plans.find((plan) => plan.price_id === priceId) || null;
};

// Removed createPaymentIntent since we're focusing on subscriptions only
export const createSubscriptionIntent = catchAsyncErrors(
	async (req, res, next) => {
		const { priceId, payment_method_id } = req.body;

		if (!priceId || !payment_method_id) {
			return next(throwError('Missing required parameters', 400));
		}

		const user = await User.findById(req.user?.id);
		if (!user) {
			return next(throwError('User not found', 404));
		}

		let customerId = user.stripeCustomerId;

		if (!customerId) {
			const customer = await stripe.customers.create({
				email: user.email,
				name: user.email,
				address: {
					line1: '123 Street',
					city: 'Lahore',
					state: 'Punjab',
					postal_code: '53800',
					country: 'IN',
				},
			});
			customerId = customer.id;
			user.stripeCustomerId = customerId;
			await user.save();
		}

		if (payment_method_id) {
			await stripe.paymentMethods.attach(payment_method_id, {
				customer: customerId,
			});

			await stripe.customers.update(customerId, {
				invoice_settings: {
					default_payment_method: payment_method_id,
				},
			});
		}

		const subscription = await stripe.subscriptions.create({
			customer: customerId,
			items: [{ price: priceId }],
			description: `Subscription for ${
				getPlanForPriceId(priceId)?.name || 'unknown plan'
			}`,
			metadata: {
				email: `${req.user?.email}`,
				userId: `${req.user?.id}`,
				type: 'subscription',
				priceId,
			},
		});

		let clientSecret;
		if (subscription.latest_invoice) {
			const latestInvoiceId = subscription.latest_invoice;
			const invoice = await stripe.invoices.retrieve(latestInvoiceId);

			if (invoice.payment_intent) {
				const paymentIntentId = invoice.payment_intent;
				const paymentIntent = await stripe.paymentIntents.retrieve(
					paymentIntentId
				);
				clientSecret = paymentIntent.client_secret;
			} else {
				console.error('No payment intent found in the invoice.');
			}
		} else {
			console.error('No latest invoice found for the subscription.');
		}

		if (!subscription || !clientSecret) {
			return next(
				throwError('Failed to create subscription and client_secret', 500)
			);
		}

		return res.json({
			success: true,
			data: {
				subscriptionId: subscription.id,
				clientSecret,
			},
		});
	}
);

export const stripePaymentWebhook = catchAsyncErrors(async (req, res, next) => {
	const sig = req.headers['stripe-signature'];

	if (!sig) {
		return res.status(400).send('Missing Stripe signature');
	}

	let event;

	try {
		const webHookSecret = process.env.STRIPE_WEBHOOK_SECRET;
		if (!webHookSecret) {
			return res.status(400).send('Missing Stripe webhook secret');
		}

		event = stripe.webhooks.constructEvent(req.body, sig, webHookSecret);
	} catch (err) {
		console.error('Webhook signature verification failed:', err?.message);
		return res.status(400).send(`Webhook Error: ${err?.message}`);
	}

	switch (event.type) {
		case 'invoice.payment_succeeded':
			try {
				const invoice = event.data.object;
				const metaData = invoice.subscription_details;

				if (!metaData || !metaData.metadata) {
					return next(throwError('Missing metadata in the invoice', 400));
				}

				if (invoice.subscription) {
					const subscriptionId = invoice.subscription;
					const subscription = await stripe.subscriptions.retrieve(
						subscriptionId
					);
					const priceId = subscription.items.data?.[0]?.price?.id;

					if (!priceId) {
						return next(throwError('Price ID not found in subscription', 500));
					}

					const plan = getPlanForPriceId(priceId);
					if (!plan) {
						return next(throwError('Invalid Price ID', 500));
					}

					const user = await User.findOne({
						$or: [
							{ _id: metaData.metadata.userId },
							{ email: metaData.metadata.email },
						],
					});

					if (!user) {
						return next(throwError('User not found!', 404));
					}

					// Update user subscription details
					const updatedUser = await User.findByIdAndUpdate(
						user._id,
						{
							$set: {
								subscription: {
									planId: priceId,
									role: plan.role,
									jobLimit: plan.jobLimit,
									visibilityDays: plan.visibilityDays,
									canTop: plan.canTop,
									topDays: plan.topDays || 0,
									subscriptionId: subscriptionId,
									activeUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days validity
								},
							},
						},
						{ new: true }
					);

					if (!updatedUser) {
						return next(throwError('Failed to update user subscription', 500));
					}

					console.log(
						`${plan.price} EUR payment succeeded for email: ${updatedUser.email}, userId: ${updatedUser.id}. ` +
							`Subscribed to ${plan.name}`
					);
				}
			} catch (error) {
				console.error('Error handling payment succeeded event:', error);
				return next(throwError('Internal Server Error', 500));
			}
			break;
		default:
			console.log(`Unhandled event type ${event.type}`);
	}

	res.status(200).send('Webhook received');
});
