document.addEventListener("DOMContentLoaded", function () {
    var ProfilesViewModel = function () {
        var self = this;

        self.ext = new ExtensionCollectionModel();
        self.profiles = new ProfileCollectionModel();
        self.current_profile = ko.observable();
        self.add_name = ko.observable("");

        // Import/Export properties
        self.showImportModal = ko.observable(false);
        self.importMode = ko.observable("merge");
        self.importError = ko.observable("");
        self.importSuccess = ko.observable("");

        self.current_name = ko.pureComputed(function () {
            return self.current_profile()
                ? self.current_profile().name()
                : null;
        });

        self.editable = ko.computed(function () {
            return self.current_profile() || false;
        });

        self.select = function (data) {
            self.current_profile(data);
        };

        self.selectAlwaysOn = function (data) {
            self.selectReserved(data, "always_on");
        };

        self.selectFavorites = function (data) {
            self.selectReserved(data, "favorites");
        };

        self.selectReserved = function (data, n) {
            self.add_name("__" + n);
            self.add();
        };

        self.selectByIndex = function (idx) {
            self.current_profile(self.profiles.items()[idx]);
        };

        self.add = function () {
            var n = self.add_name();
            var enabled = self.ext.enabled.pluck();
            if (n) {
                var p = self.profiles.find(n);
                if (!p) {
                    // Warning! slice or the array reference will mix up between all instances.
                    self.profiles.add(n, enabled.slice());
                    self.selectByIndex(self.profiles.items().length - 1);
                } else {
                    self.current_profile(p);
                }
                self.add_name("");
            }
        };

        self.remove = function (profile) {
            var c = profile == self.current_profile();
            if (confirm("Are you sure you want to remove this profile?")) {
                self.profiles.remove(profile);
                if (c) self.selectByIndex(0); // Select first one if removing the current.
            }
        };

        self.save = function () {
            self.profiles.save(function () {
                fadeOutMessage("save-result");
            });
        };

        self.close = function () {
            window.close();
        };

        self.toggleAll = function () {
            var exts = _(self.ext.extensions()).map(function (i) {
                return i.id();
            });
            self.current_profile().items(exts);
        };

        self.toggleNone = function () {
            if (self.current_profile()) self.current_profile().items([]);
        };

        // Import/Export methods
        self.showImportDialog = function () {
            self.importError("");
            self.importSuccess("");
            self.showImportModal(true);
        };

        self.hideImportDialog = function () {
            self.showImportModal(false);
            // Reset the file input
            document.getElementById("import-file").value = "";
        };

        self.exportProfiles = function () {
            // Create a JSON object with all profiles
            var profilesData = {};

            _(self.profiles.items()).each(function (profile) {
                if (profile.name()) {
                    profilesData[profile.name()] = profile.items();
                }
            });

            // Convert to JSON string
            var jsonData = JSON.stringify(
                {
                    profiles: profilesData,
                    exportDate: new Date().toISOString(),
                    version: "1.0",
                },
                null,
                2
            );

            // Create a blob and download link
            var blob = new Blob([jsonData], { type: "application/json" });
            var url = URL.createObjectURL(blob);

            // Create a temporary link and click it to download
            var a = document.createElement("a");
            a.href = url;
            a.download =
                "extensity-profiles-" +
                new Date().toISOString().slice(0, 10) +
                ".json";
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        };

        self.importProfiles = function () {
            var fileInput = document.getElementById("import-file");

            if (!fileInput.files || fileInput.files.length === 0) {
                self.importError("Please select a file to import.");
                return;
            }

            var file = fileInput.files[0];
            var reader = new FileReader();

            reader.onload = function (e) {
                try {
                    var importedData = JSON.parse(e.target.result);

                    // Validate the imported data
                    if (!importedData.profiles) {
                        self.importError(
                            "Invalid profile data: missing profiles."
                        );
                        return;
                    }

                    // Process the import based on the selected mode
                    if (self.importMode() === "replace") {
                        // Clear existing profiles
                        self.profiles.items.removeAll();
                    }

                    // Import the profiles
                    var importCount = 0;
                    var updateCount = 0;

                    _(importedData.profiles).each(function (items, name) {
                        var existingProfile = self.profiles.find(name);

                        if (existingProfile) {
                            // Update existing profile if in merge mode
                            if (self.importMode() === "merge") {
                                existingProfile.items(items);
                                updateCount++;
                            }
                        } else {
                            // Add new profile
                            self.profiles.add(name, items);
                            importCount++;
                        }
                    });

                    // Save the changes
                    self.profiles.save(function () {
                        var message = "Import successful! ";
                        if (importCount > 0) {
                            message +=
                                importCount + " new profile(s) imported. ";
                        }
                        if (updateCount > 0) {
                            message +=
                                updateCount + " existing profile(s) updated.";
                        }
                        self.importSuccess(message);

                        // Reset the file input
                        fileInput.value = "";

                        // Refresh the view after a short delay
                        setTimeout(function () {
                            self.hideImportDialog();
                            // Reload the page to show the updated profiles
                            window.location.reload();
                        }, 2000);
                    });
                } catch (error) {
                    self.importError(
                        "Error importing profiles: " + error.message
                    );
                }
            };

            reader.onerror = function () {
                self.importError("Error reading file.");
            };

            reader.readAsText(file);
        };

        try {
            new DismissalsCollection().dismiss("profile_page_viewed");
            self.selectByIndex(0);
        } catch (e) {
            /*No profiles*/
        }
    };

    vm = new ProfilesViewModel();

    ko.bindingProvider.instance = new ko.secureBindingsProvider({});
    ko.applyBindings(vm, document.getElementById("profiles"));
});
