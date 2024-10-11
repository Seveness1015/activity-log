const github = require('@actions/github');
const core = require('@actions/core');
const eventDescriptions = require('./eventDescriptions');
const { username, token, eventLimit, style, ignoreEvents } = require('../config');

// Create an authenticated Octokit client
const octokit = github.getOctokit(token);

// Function to fetch starred repositories with pagination
async function fetchAllStarredRepos() {
    let starredRepos = [];
    let page = 1;

    while (true) {
        try {
            const { data: pageStarredRepos } = await octokit.rest.activity.listReposStarredByAuthenticatedUser({
                per_page: 100,
                page
            });

            if (pageStarredRepos.length === 0) {
                break;
            }

            starredRepos = starredRepos.concat(pageStarredRepos);
            page++;
        } catch (error) {
            core.setFailed(`❌ Error fetching starred repositories: ${error.message}`);
            process.exit(1);
        }
    }

    // Create a set of starred repo names
    const starredRepoNames = new Set(starredRepos.map(repo => `${repo.owner.login}/${repo.name}`));

    return { starredRepoNames };
}

// Function to check if the event was likely triggered by GitHub Actions or bots
function isTriggeredByGitHubActions(event) {
    // Regex patterns to match common GitHub Actions or bot commit messages
    const botPatterns = /(\[bot\]|GitHub Actions|github-actions)/i;

    // Check if the commit author name matches any of the bot patterns
    const isCommitEvent = event.type === 'PushEvent' && event.payload && event.payload.commits;
    if (isCommitEvent) {
        return event.payload.commits.some(commit =>
            botPatterns.test(commit.author.name) // Test commit message against regex patterns
        );
    }
    return false;
}

// Helper function to encode URLs
function encodeHTML(str) {
    return str
        .replace(/`([^`]+)`/g, '<code>$1</code>') // Convert inline code (single backticks) to HTML <code> tags
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'); // Convert [text](url) to <a href="url">text</a>
}

// Function to fetch all events with pagination and apply filtering
async function fetchAllEvents() {
    let allEvents = [];
    let page = 1;

    while (allEvents.length < eventLimit) {
        try {
            const { data: events } = await octokit.rest.activity.listEventsForAuthenticatedUser({
                username,
                per_page: 100,
                page
            });

            // Check for API rate limit or pagination issues
            if (events.length === 0) {
                core.warning('⚠️ No more events available.');
                break; // No more events to fetch
            }

            allEvents = allEvents.concat(events);
            page++;

            // Exit loop if we have enough events
            if (allEvents.length >= eventLimit) {
                break;
            }
        } catch (error) {
            core.setFailed(`❌ Error fetching events: ${error.message}`);
            process.exit(1);
        }
    }

    return allEvents;
}

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

//        if (filteredEvents.length < eventLimit) {
//            const additionalEvents = await fetchAllEvents();
//            allEvents = additionalEvents.concat(allEvents);
//        } else {
            break;
//        }
    }
}
// This is the sentence to change the .js
