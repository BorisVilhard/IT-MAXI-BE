const BASE_PRICE = 1;
const INCREMENT_PRICE = 0.5;
const TOKEN_STEP = 100;

export const removePasswordField = (data) => {
	const { password, ...otherFields } = data;
	return otherFields;
};

export const calculateTokensForAmount = (amount) => {
	let tokensNeeded = MIN_TOKENS;

	if (amount > BASE_PRICE) {
		const extraAmount = amount - BASE_PRICE;
		const extraTokens = (extraAmount / INCREMENT_PRICE) * TOKEN_STEP;
		tokensNeeded += extraTokens;
	}

	return tokensNeeded;
};

const plans = [
	{
		name: 'Tier 1',
		tokens: 1000,
		price: 7,
		tier: 1,
		price_id: 'price_1QhwXpSGotLD6A2MwzOISPA0',
	},
	{
		name: 'Tier 2',
		tokens: 2300,
		price: 14,
		tier: 2,
		price_id: 'price_1QhwYhSGotLD6A2MOyTnwHsY',
	},
	{
		name: 'Tier 3',
		tokens: 3600,
		price: 21,
		tier: 3,
		price_id: 'price_1QhwZOSGotLD6A2Mm2pejKM0',
	},
];

export function getPlanForPriceId(priceId) {
	const plan = plans.find((plan) => plan.price_id === priceId);

	if (plan) {
		return plan;
	}

	return null;
}
