import airbnbConfig from './configs/airbnb.js';
import importConfig from './configs/import.js';
import jsonRecommendedConfig from './configs/json/recommended.js';
import markdownRecommendedConfig from './configs/markdown/recommended.js';
import recommendedConfig from './configs/recommended.js';
import strictConfig from './configs/strict.js';
import { overrideWith } from './overrideHelpers.js';

export default {
  configs: {
    airbnb: airbnbConfig,
    import: importConfig,
    'json/recommended': jsonRecommendedConfig,
    'markdown/recommended': markdownRecommendedConfig,
    recommended: recommendedConfig,
    strict: strictConfig,
  },
  overrideWith,
};
