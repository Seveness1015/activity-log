const { fetchAndFilterEvents } = require('./utils/github');
const { updateReadme } = require('./utils/file');
const { username, token, eventLimit, ignoreEvents, readmePath, commitMessage } = require('./config');
const core = require('@actions/core')

// GPT
// Function to fetch and filter events
async function fetchAndFilterEvents() {
    const { starredRepoNames } = await fetchAllStarredRepos();
    let allEvents = await fetchAllEvents();

    let filteredEvents = [];

    while (filteredEvents.length < eventLimit) {
        filteredEvents = allEvents
            .filter(event => !ignoreEvents.includes(event.type))
            .filter(event => !isTriggeredByGitHubActions(event))
            .map(event => {
                if (event.type === 'WatchEvent') {
                    const isStarred = starredRepoNames.has(event.repo.name);
                    // Change the event type to 'StarEvent' if the repo is starred
                    return { ...event, type: isStarred ? 'StarEvent' : 'WatchEvent' };
                }
                return event;
            })
            .slice(0, eventLimit);

        break;
    }

    // 加入返回值，返回篩選後的事件
    return filteredEvents;
}


// Execute the main function
main();
