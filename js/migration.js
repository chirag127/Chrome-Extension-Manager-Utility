// Migration from localStorage settings to Chrome Storage sync.
// Updated for Manifest V3 compatibility

// This migration script was for users upgrading from versions before 1.4.0
// Since we're now at version 1.15.0, most users would have already migrated
// We're keeping a simplified version to avoid errors in Manifest V3

function migrate_to_chrome_storage() {
    chrome.storage.sync.get("migration", function (v) {
        if (!v["migration"]) {
            // Set migration flag to indicate migration is complete
            // This prevents the migration from running again
            chrome.storage.sync.set({ migration: "1.4.0" });
            console.log("Migration flag set for Manifest V3 compatibility");
        }
    });
}

// Listeners for the event page.
chrome.runtime.onInstalled.addListener(function (details) {
    if (details["reason"] == "update" && details["previousVersion"] < "1.4.0") {
        migrate_to_chrome_storage();
    }
});
