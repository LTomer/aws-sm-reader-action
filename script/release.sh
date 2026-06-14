#!/bin/bash
set -e

# Variables
semver_tag_regex='v[0-9]+\.[0-9]+\.[0-9]+$'
semver_tag_glob='v[0-9].[0-9].[0-9]*'

# Terminal colors
OFF='\033[0m'
BOLD_RED='\033[1;31m'
BOLD_GREEN='\033[1;32m'
BOLD_BLUE='\033[1;34m'
BOLD='\033[1m'

# 1. Retrieve the latest release tag
if ! latest_tag=$(git describe --abbrev=0 --match="$semver_tag_glob"); then
	latest_tag="[unknown]"
fi

echo -e "The latest release tag is: ${BOLD_BLUE}${latest_tag}${OFF}"

# 2. Prompt the user for a new release tag
read -r -p 'Enter a new release tag (vX.X.X format): ' new_tag

# 3. Validate syntax
if echo "$new_tag" | grep -q -E "$semver_tag_regex"; then
	echo -e "Tag: ${BOLD_BLUE}$new_tag${OFF} is valid syntax"
else
	echo -e "Tag: ${BOLD_BLUE}$new_tag${OFF} is ${BOLD_RED}not valid${OFF} (must be in ${BOLD}vX.X.X${OFF} format)"
	exit 1
fi

# 4. Remind user to update package.json
echo -e -n "Make sure the version field in package.json is ${BOLD_BLUE}$new_tag${OFF}. Yes? [Y/n] "
read -r YN

if [[ ! ($YN == "y" || $YN == "Y") ]]; then
	echo -e "Please update the package.json version to ${BOLD_BLUE}$new_tag${OFF} and commit your changes."
	exit 1
fi

# 5. Tag and push ONLY the specific version. 
# The GitHub Action workflow will handle creating/moving v1 and v1.0 automatically.
git tag "$new_tag"
git push origin "$new_tag"

echo -e "${BOLD_GREEN}Done! Specific tag pushed. GitHub Actions will now generate the rolling vX and vX.X tags on the server.${OFF}"
