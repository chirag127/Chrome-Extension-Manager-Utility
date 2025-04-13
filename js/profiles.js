document.addEventListener("DOMContentLoaded", function () {
    var ProfilesViewModel = function () {
        var self = this;

        self.ext = new ExtensionCollectionModel();
        self.profiles = new ProfileCollectionModel();
        self.current_profile = ko.observable();
        self.add_name = ko.observable("");

        // Import/Export properties will be handled with direct DOM manipulation

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

        // We'll add the import/export functionality after the view model is initialized

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

    // Add import/export functionality using direct DOM manipulation
    // We're already inside a DOMContentLoaded event, so we can add our code directly
    (function () {
        // Get DOM elements
        var exportBtn = document.getElementById("export-profiles-btn");
        var importBtn = document.getElementById("import-profiles-btn");
        var importModal = document.getElementById("import-modal");
        var closeModalBtn = document.getElementById("close-import-modal");
        var cancelImportBtn = document.getElementById("cancel-import-btn");
        var confirmImportBtn = document.getElementById(
            "import-profiles-confirm-btn"
        );
        var importFileInput = document.getElementById("import-file");
        var importErrorDiv = document.getElementById("import-error");
        var importSuccessDiv = document.getElementById("import-success");

        // Function to show the import modal
        function showImportModal() {
            // Clear previous messages
            importErrorDiv.style.display = "none";
            importSuccessDiv.style.display = "none";
            importErrorDiv.textContent = "";
            importSuccessDiv.textContent = "";
            // Clear file input
            importFileInput.value = "";
            // Show modal
            importModal.style.display = "block";
        }

        // Function to hide the import modal
        function hideImportModal() {
            importModal.style.display = "none";
        }

        // Function to show error message
        function showError(message) {
            importErrorDiv.textContent = message;
            importErrorDiv.style.display = "block";
            importSuccessDiv.style.display = "none";
        }

        // Function to show success message
        function showSuccess(message) {
            importSuccessDiv.textContent = message;
            importSuccessDiv.style.display = "block";
            importErrorDiv.style.display = "none";
        }

        // Function to export profiles
        function exportProfiles() {
            // Create a JSON object with all profiles
            var profilesData = {};

            _(vm.profiles.items()).each(function (profile) {
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
        }

        // Function to import profiles
        function importProfiles() {
            if (!importFileInput.files || importFileInput.files.length === 0) {
                showError("Please select a file to import.");
                return;
            }

            var file = importFileInput.files[0];
            var reader = new FileReader();

            reader.onload = function (e) {
                try {
                    var importedData = JSON.parse(e.target.result);

                    // Validate the imported data
                    if (!importedData.profiles) {
                        showError("Invalid profile data: missing profiles.");
                        return;
                    }

                    // Get the selected import mode
                    var importMode = document.querySelector(
                        'input[name="import-mode"]:checked'
                    ).value;

                    // Process the import based on the selected mode
                    if (importMode === "replace") {
                        // Clear existing profiles
                        vm.profiles.items.removeAll();
                    }

                    // Import the profiles
                    var importCount = 0;
                    var updateCount = 0;

                    _(importedData.profiles).each(function (items, name) {
                        var existingProfile = vm.profiles.find(name);

                        if (existingProfile) {
                            // Update existing profile if in merge mode
                            if (importMode === "merge") {
                                existingProfile.items(items);
                                updateCount++;
                            }
                        } else {
                            // Add new profile
                            vm.profiles.add(name, items);
                            importCount++;
                        }
                    });

                    // Save the changes
                    vm.profiles.save(function () {
                        var message = "Import successful! ";
                        if (importCount > 0) {
                            message +=
                                importCount + " new profile(s) imported. ";
                        }
                        if (updateCount > 0) {
                            message +=
                                updateCount + " existing profile(s) updated.";
                        }
                        showSuccess(message);

                        // Reset the file input
                        importFileInput.value = "";

                        // Refresh the view after a short delay
                        setTimeout(function () {
                            hideImportModal();
                            // Reload the page to show the updated profiles
                            window.location.reload();
                        }, 2000);
                    });
                } catch (error) {
                    showError("Error importing profiles: " + error.message);
                }
            };

            reader.onerror = function () {
                showError("Error reading file.");
            };

            reader.readAsText(file);
        }

        // Add event listeners
        exportBtn.addEventListener("click", exportProfiles);
        importBtn.addEventListener("click", showImportModal);
        closeModalBtn.addEventListener("click", hideImportModal);
        cancelImportBtn.addEventListener("click", hideImportModal);
        confirmImportBtn.addEventListener("click", importProfiles);

        // Close modal when clicking outside of it
        window.addEventListener("click", function (event) {
            if (event.target === importModal) {
                hideImportModal();
            }
        });
    })();
});
