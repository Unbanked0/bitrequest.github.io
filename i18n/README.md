# I18n

The dictionary (unique file) is in `dictionary.db`

Locales have to be extracted by using `extract.sh` (make it executable, then run it from root: `./i18n/extract.sh`)

This will generate the `/dictionary_XX.js`

The `dictionary.db` file format is self-explanatory though it was made for machines before humans, so is sensitive to spaces, tabulations, ... (and has no comments allowed)