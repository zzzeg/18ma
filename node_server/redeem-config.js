const REDEEM_DURATION_OPTIONS = [
  { label: '1 小时', value: '1h' },
  { label: '3 小时', value: '3h' },
  { label: '6 小时', value: '6h' },
  { label: '12 小时', value: '12h' },
  { label: '1 天', value: '1d' },
  { label: '3 天', value: '3d' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' }
];

const REDEEM_DURATION_VALUES = REDEEM_DURATION_OPTIONS.map((item) => item.value);
const ALLOWED_DURATION_CODES = new Set(REDEEM_DURATION_VALUES);

module.exports = {
  REDEEM_DURATION_OPTIONS,
  REDEEM_DURATION_VALUES,
  ALLOWED_DURATION_CODES
};
