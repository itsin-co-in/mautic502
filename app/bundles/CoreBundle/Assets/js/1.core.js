var MauticVars  = {};
var mQuery      = jQuery.noConflict(true);
window.jQuery   = mQuery;

// Polyfil for ES6 startsWith method
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}

//set default ajax options
MauticVars.activeRequests = 0;

mQuery.ajaxSetup({
    beforeSend: function (request, settings) {
        if (settings.showLoadingBar) {
            Mautic.startPageLoadingBar();
        }

        if (typeof IdleTimer != 'undefined') {
            //append last active time
            var userLastActive = IdleTimer.getLastActive();
            var queryGlue = (settings.url.indexOf("?") == -1) ? '?' : '&';

            settings.url = settings.url + queryGlue + 'mauticUserLastActive=' + userLastActive;
        }

        if (mQuery('#mauticLastNotificationId').length) {
            //append last notifications
            var queryGlue = (settings.url.indexOf("?") == -1) ? '?' : '&';

            settings.url = settings.url + queryGlue + 'mauticLastNotificationId=' + mQuery('#mauticLastNotificationId').val();
        }

        // Set CSRF token to each AJAX POST request
        if (settings.type == 'POST') {
            request.setRequestHeader('X-CSRF-Token', mauticAjaxCsrf);
        }

        return true;
    },

    cache: false
});

mQuery( document ).ajaxComplete(function(event, xhr, settings) {
    Mautic.stopPageLoadingBar();
    if (xhr.responseJSON && xhr.responseJSON.flashes) {
        Mautic.setFlashes(xhr.responseJSON.flashes);
    }
});

// Force stop the page loading bar when no more requests are being in progress
mQuery( document ).ajaxStop(function(event) {
    // Seems to be stuck
    MauticVars.activeRequests = 0;
    Mautic.stopPageLoadingBar();
    initializeCodeBlocks();
});

mQuery( document ).ready(function() {
    // Load user preferences for UI saved previously
    const prefix = 'm-toggle-setting-';
    Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .forEach(setting => {
            const attributeName = setting.replace(prefix, '');
            const value = localStorage.getItem(setting);

            if (value) {
                document.documentElement.setAttribute(attributeName, value);
            }
        });

    // Handle radio button changes
    document.querySelectorAll('input[type="radio"][data-attribute-toggle]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                const attributeName = this.dataset.attributeToggle;
                const newValue = this.dataset.attributeValue;
                document.documentElement.setAttribute(attributeName, newValue);
                localStorage.setItem(`${prefix}${attributeName}`, newValue);
            }
        });
    });

    if (typeof mauticContent !== 'undefined') {
        mQuery("html").Core({
            console: false
        });
    }

    // Prevent backspace from activating browser back
    mQuery(document).on('keydown', function (e) {
        if (e.which === 8 && !mQuery(e.target).is("input:not([readonly]):not([type=radio]):not([type=checkbox]), textarea, [contentEditable], [contentEditable=true]")) {
            e.preventDefault();
        }
    });

    // Try to keep alive the session.
    setInterval(function() {
        if (window.location.pathname.startsWith('/s/') && window.location.pathname !== '/s/login') {
            mQuery.get('/s/keep-alive')
                .fail(function(errorThrown) {
                    console.error('Error with keep-alive:', errorThrown);
                });
        }
    }, mauticSessionLifetime * 1000 / 2);

    // Copy code block on click
    mQuery(document).on('click', 'code', function() {
        var $codeBlock = mQuery(this);
        var $icon = $codeBlock.find('.copy-icon');
        var $temp = mQuery('<textarea>');
        mQuery('body').append($temp);
        $temp.val($codeBlock.text()).select();
        document.execCommand('copy');
        $temp.remove();
        $icon.removeClass('ri-clipboard-fill').addClass('ri-check-line');
        setTimeout(function() {
            $icon.removeClass('ri-check-line').addClass('ri-clipboard-fill');
        }, 2000);
    });
    initializeCodeBlocks();
});

function initializeCodeBlocks() {
    mQuery('code').each(function() {
        var $codeBlock = mQuery(this);
        if (!$codeBlock.find('.copy-icon').length) {
            $codeBlock.append('<i class="ri-clipboard-fill ml-xs copy-icon"></i>');
        }
    });
}

if (typeof history != 'undefined') {
    //back/forward button pressed
    window.addEventListener('popstate', function (event) {
        window.location.reload();
    });
}

//used for spinning icons to show something is in progress)
MauticVars.iconClasses          = {};

//prevent multiple ajax calls from multiple clicks
MauticVars.routeInProgress       = '';

//prevent interval ajax requests from overlapping
MauticVars.moderatedIntervals    = {};
MauticVars.intervalsInProgress   = {};

var Mautic = {
    loadedContent: {},

    keyboardShortcutHtml: {},

    /**
     *
     * @param sequence
     * @param description
     * @param func
     * @param section
     */
    addKeyboardShortcut: function (sequence, description, func, section) {
        Mousetrap.bind(sequence, func);
        var sectionName = section || 'global';

        if (!Mautic.keyboardShortcutHtml.hasOwnProperty(sectionName)) {
            Mautic.keyboardShortcutHtml[sectionName] = {};
        }

        Mautic.keyboardShortcutHtml[sectionName][sequence] = '<div class="col-xs-6"><mark>' + sequence + '</mark>: ' + description + '</div>';
    },

    /**
     * Binds global keyboard shortcuts
     */
    bindGlobalKeyboardShortcuts: function () {
        Mautic.addKeyboardShortcut('g d', 'Load the Dashboard', function (e) {
            mQuery('#mautic_dashboard_index').click();
        });

        Mautic.addKeyboardShortcut('g c', 'Load Contacts', function (e) {
            mQuery('#mautic_contact_index').click();
        });

        Mautic.addKeyboardShortcut('g e', 'Load Emails', function (e) {
            mQuery('#mautic_email_index').click();
        });

        Mautic.addKeyboardShortcut('g f', 'Load Forms', function (e) {
            mQuery('#mautic_form_index').click();
        });

        Mautic.addKeyboardShortcut('g s', 'Load Segments', function (e) {
            mQuery('#mautic_segment_index').click();
        });

        Mautic.addKeyboardShortcut('g p', 'Load Segments', function (e) {
            mQuery('#mautic_page_index').click();
        });

        Mautic.addKeyboardShortcut('f m', 'Toggle Admin Menu', function (e) {
            mQuery("#admin-menu").click();
        });

        Mautic.addKeyboardShortcut('f n', 'Show Notifications', function (e) {
            mQuery('.dropdown-notification').click();
        });

        Mautic.addKeyboardShortcut('f /', 'Global Search', function (e) {
            mQuery('#globalSearchContainer .search-button').click();
        });

        Mautic.addKeyboardShortcut('/', 'Search current list', function (e) {
            e.preventDefault();
            e.stopPropagation();
            mQuery('#list-search').focus();
        });

        Mautic.addKeyboardShortcut('e', 'Edit current resource', function(e) {
            mQuery('#edit').click();
        });

        Mautic.addKeyboardShortcut('c', 'Create current resource', function(e) {
            mQuery('#new').click();
        });

        Mautic.addKeyboardShortcut(['del', 'meta+backspace'], 'Delete current resource', function(e) {
            mQuery('#delete').click();
        });

        Mautic.addKeyboardShortcut('enter', 'Modal confirm action', function(e) {
            mQuery('#confirm').click();
        });

        Mautic.addKeyboardShortcut('s', 'General send example button', function(e) {
            mQuery('#sendEmailButton').click();
        });

        Mautic.addKeyboardShortcut('g i', 'Back to index (list)', function(e) {
            mQuery('[id*="buttons_cancel"]').click();
            mQuery('#close').click();
        });

        Mousetrap.bind('?', function (e) {
            var modalWindow = mQuery('#keyboardShortcutsModal');
            modalWindow.modal();
        });

    },

    /**
     * Translations
     *
     * @param id     string
     * @param params object
     */
    translate: function (id, params) {
        if (!mauticLang.hasOwnProperty(id)) {
            return id;
        }

        var translated = mauticLang[id];

        if (params) {
            for (var key in params) {
                if (!params.hasOwnProperty(key)) continue;

                var regEx = new RegExp('%' + key + '%', 'g');
                translated = translated.replace(regEx, params[key])
            }
        }

        return translated;
    },

    /**
     * Stops the ajax page loading indicator
     */
    stopPageLoadingBar: function () {
        if (MauticVars.activeRequests < 1) {
            MauticVars.activeRequests = 0;
        } else {
            MauticVars.activeRequests--;
        }

        if (MauticVars.loadingBarTimeout) {
            clearTimeout(MauticVars.loadingBarTimeout);
        }

        if (MauticVars.activeRequests == 0) {
            mQuery('.loading-bar').removeClass('active');
        }
    },

    /**
     * Activate page loading bar
     */
    startPageLoadingBar: function () {
        mQuery('.loading-bar').addClass('active');
        MauticVars.activeRequests++;
    },

    /**
     * Starts the ajax loading indicator for the right canvas
     */
    startCanvasLoadingBar: function () {
        mQuery('.canvas-loading-bar').addClass('active');
    },

    /**
     * Starts the ajax loading indicator for modals
     *
     * @param modalTarget
     */
    startModalLoadingBar: function (modalTarget) {
        mQuery(modalTarget + ' .modal-loading-bar').addClass('active');
    },

    /**
     * Stops the ajax loading indicator for the right canvas
     */
    stopCanvasLoadingBar: function () {
        mQuery('.canvas-loading-bar').removeClass('active');
    },

    /**
     * Stops the ajax loading indicator for modals
     */
    stopModalLoadingBar: function (modalTarget) {
        mQuery(modalTarget + ' .modal-loading-bar').removeClass('active');
    },

    /**
     * Activate label loading spinner
     *
     * @param button (jQuery element)
     */
    activateButtonLoadingIndicator: function (button) {
        button.prop('disabled', true);
        if (!button.find('.ri-loader-3-line.ri-spin').length) {
            button.append(mQuery('<i class="ri-loader-3-line ri-spin ri-fw"></i>'));
        }
    },

    /**
     * Remove the spinner from label
     *
     * @param button (jQuery element)
     */
    removeButtonLoadingIndicator: function (button) {
        button.prop('disabled', false);
        button.find('.ri-loader-3-line').remove();
    },

    /**
     * Activate label loading spinner
     *
     * @param el
     */
    activateLabelLoadingIndicator: function (el) {
        var labelSpinner = mQuery("label[for='" + el + "']");
        Mautic.labelSpinner = mQuery('<i class="ri-loader-3-line ri-spin ri-fw"></i>');
        labelSpinner.append(Mautic.labelSpinner);
    },

    /**
     * Remove the spinner from label
     */
    removeLabelLoadingIndicator: function () {
        mQuery(Mautic.labelSpinner).remove();
    },

    /**
     * Open a popup
     * @param options
     */
    loadNewWindow: function (options) {
        if (options.windowUrl) {
            Mautic.startModalLoadingBar();

            var popupName = 'mauticpopup';
            if (options.popupName) {
                popupName = options.popupName;
            }

            setTimeout(function () {
                var opener = window.open(options.windowUrl, popupName, 'height=600,width=1100');

                if (!opener || opener.closed || typeof opener.closed == 'undefined') {
                    alert(mauticLang.popupBlockerMessage);
                } else {
                    opener.onload = function () {
                        Mautic.stopModalLoadingBar();
                        Mautic.stopIconSpinPostEvent();
                    };
                }
            }, 100);
        }
    },

    /**
     * Inserts a new javascript file request into the document head
     *
     * @param url
     * @param onLoadCallback
     * @param alreadyLoadedCallback
     */
    loadScript: function (url, onLoadCallback, alreadyLoadedCallback) {
        // check if the asset has been loaded
        if (typeof Mautic.headLoadedAssets == 'undefined') {
            Mautic.headLoadedAssets = {};
        } else if (typeof Mautic.headLoadedAssets[url] != 'undefined') {
            // URL has already been appended to head

            if (alreadyLoadedCallback && typeof Mautic[alreadyLoadedCallback] == 'function') {
                Mautic[alreadyLoadedCallback]();
            }

            return;
        }

        // Note that asset has been appended
        Mautic.headLoadedAssets[url] = 1;

        mQuery.getScript(url, function (data, textStatus, jqxhr) {
            if (textStatus == 'success') {
                if (onLoadCallback && typeof Mautic[onLoadCallback] == 'function') {
                    Mautic[onLoadCallback]();
                } else if (typeof Mautic[mauticContent + "OnLoad"] == 'function') {
                    // Likely a page refresh; execute onLoad content
                    if (typeof Mautic.loadedContent[mauticContent] == 'undefined') {
                        Mautic.loadedContent[mauticContent] = true;
                        Mautic[mauticContent + "OnLoad"]('#app-content', {});
                    }
                }
            }
        });
    },

    /**
     * Inserts a new stylesheet into the document head
     *
     * @param url
     */
    loadStylesheet: function (url) {
        // check if the asset has been loaded
        if (typeof Mautic.headLoadedAssets == 'undefined') {
            Mautic.headLoadedAssets = {};
        } else if (typeof Mautic.headLoadedAssets[url] != 'undefined') {
            // URL has already been appended to head
            return;
        }

        // Note that asset has been appended
        Mautic.headLoadedAssets[url] = 1;

        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = url;
        mQuery('head').append(link);
    },

    /**
     * Just a little visual that an action is taking place
     *
     * @param event|string
     */
    startIconSpinOnEvent: function (target) {
        if (MauticVars.ignoreIconSpin) {
            MauticVars.ignoreIconSpin = false;
            return;
        }

        if (typeof target == 'object' && typeof(target.target) !== 'undefined') {
            target = target.target;
        }

        if (mQuery(target).length) {
            var hasBtn = mQuery(target).hasClass('btn');
            var hasIcon = mQuery(target).attr('class') && mQuery(target).attr('class').startsWith('ri-');
            var dontspin = mQuery(target).hasClass('btn-nospin');

            var icon = (hasBtn && mQuery(target).find('i[class^="ri-"]').length) ? mQuery(target).find('i[class^="ri-"]') : target;

            if (!dontspin && ((hasBtn && mQuery(target).find('i[class^="ri-"]').length) || hasIcon)) {
                var el = (hasIcon) ? target : mQuery(target).find('i[class^="ri-"]').first();
                var identifierClass = (new Date).getTime();

                if (typeof MauticVars.iconClasses === 'undefined') {
                    MauticVars.iconClasses = {};
                }
                MauticVars.iconClasses[identifierClass] = mQuery(el).attr('class');

                var specialClasses = ['ri-fw', 'ri-lg', 'ri-2x', 'ri-3x', 'ri-4x', 'ri-5x', 'ri-li', 'text-white', 'text-muted'];
                var appendClasses = "";

                for (var j = 0; j < specialClasses.length; j++) {
                    if (mQuery(el).hasClass(specialClasses[j])) {
                        appendClasses += " " + specialClasses[j];
                    }
                }
                mQuery(el).removeClass();
                mQuery(el).addClass('ri-loader-3-line ri-spin ' + identifierClass + appendClasses);
            }
        }
    },

    /**
     * Stops the icon spinning after an event is complete
     */
    stopIconSpinPostEvent: function (specificId) {
        if (typeof specificId != 'undefined' && specificId in MauticVars.iconClasses) {
            mQuery('.' + specificId).removeClass('ri-loader-3-line ri-spin ' + specificId).addClass(MauticVars.iconClasses[specificId]);
            delete MauticVars.iconClasses[specificId];
        } else {
            mQuery.each(MauticVars.iconClasses, function (index, value) {
                mQuery('.' + index).removeClass('ri-loader-3-line ri-spin ' + index).addClass(value);
                delete MauticVars.iconClasses[index];
            });
        }
    },

    /**
     * Displays backdrop with wait message then redirects
     *
     * @param url
     */
    redirectWithBackdrop: function (url) {
        Mautic.activateBackdrop();
        setTimeout(function () {
            window.location = url;
        }, 50);
    },

    /**
     * Acivates a backdrop
     */
    activateBackdrop: function (hideWait) {
        if (!mQuery('#mautic-backdrop').length) {
            var container = mQuery('<div />', {
                id: 'mautic-backdrop'
            });

            mQuery('<div />', {
                'class': 'modal-backdrop fade in'
            }).appendTo(container);

            if (typeof hideWait == 'undefined') {
                mQuery('<div />', {
                    "class": 'mautic-pleasewait'
                }).html(mauticLang.pleaseWait)
                    .appendTo(container);
            }

            container.appendTo('body');
        }
    },

    /**
     * Deactivates backdrop
     */
    deactivateBackgroup: function () {
        if (mQuery('#mautic-backdrop').length) {
            mQuery('#mautic-backdrop').remove();
        }
    },

    /**
     * Executes an object action
     *
     * @param action
     */
    executeAction: function (action, callback) {
        if (typeof Mautic.activeActions == 'undefined') {
            Mautic.activeActions = {};
        } else if (typeof Mautic.activeActions[action] != 'undefined') {
            // Action is currently being executed
            return;
        }

        Mautic.activeActions[action] = true;

        //dismiss modal if activated
        Mautic.dismissConfirmation();

        if (action.indexOf('batchExport') >= 0) {
            delete Mautic.activeActions[action]
            Mautic.initiateFileDownload(action);
            return;
        }

        mQuery.ajax({
            showLoadingBar: true,
            url: action,
            type: "POST",
            dataType: "json",
            success: function (response) {
                Mautic.processPageContent(response);

                if (typeof callback == 'function') {
                    callback(response);
                }
            },
            error: function (request, textStatus, errorThrown) {
                Mautic.processAjaxError(request, textStatus, errorThrown);
            },
            complete: function () {
                delete Mautic.activeActions[action]
            }
        });
    },

    /**
     * Processes ajax errors
     *
     *
     * @param request
     * @param textStatus
     * @param errorThrown
     */
    processAjaxError: function (request, textStatus, errorThrown, mainContent) {
        if (textStatus == 'abort') {
            Mautic.stopPageLoadingBar();
            Mautic.stopCanvasLoadingBar();
            Mautic.stopIconSpinPostEvent();
            return;
        }

        var inDevMode = typeof mauticEnv !== 'undefined' && mauticEnv == 'dev';

        if (inDevMode) {
            console.log(request);
        }

        if (typeof request.responseJSON !== 'undefined') {
            response = request.responseJSON;
        } else if (typeof(request.responseText) !== 'undefined') {
            const flashMessage = Mautic.addFlashMessage(Mautic.translate('mautic.core.request.error'));
            Mautic.setFlashes(flashMessage);

            //Symfony may have added some excess buffer if an exception was hit during a sub rendering and because
            //it uses ob_start, PHP dumps the buffer upon hitting the exception.  So let's filter that out.
            var errorStart = request.responseText.indexOf('{"newContent');
            var jsonString = request.responseText.slice(errorStart);

            if (jsonString) {
                try {
                    var response = JSON.parse(jsonString);
                    if (inDevMode) {
                        console.log(response);
                    }
                } catch (err) {
                    if (inDevMode) {
                        console.log(err);
                    }
                }
            } else {
                response = {};
            }
        }

        if (response) {
            if (response.newContent && mainContent) {
                //an error page was returned
                mQuery('#app-content .content-body').html(response.newContent);
                if (response.route && response.route.indexOf("ajax") == -1) {
                    //update URL in address bar
                    history.pushState(null, "Mautic", response.route);
                }
            } else if (response.newContent && mQuery('.modal.in').length) {
                //assume a modal was the recipient of the information
                mQuery('.modal.in .modal-body-content').html(response.newContent);
                mQuery('.modal.in .modal-body-content').removeClass('hide');
                if (mQuery('.modal.in  .loading-placeholder').length) {
                    mQuery('.modal.in  .loading-placeholder').addClass('hide');
                }
            } else if (inDevMode) {
                console.log(response);

                if (response.errors && response.errors[0] && response.errors[0].message) {
                    alert(response.errors[0].message);
                }
            }
        }

        Mautic.stopPageLoadingBar();
        Mautic.stopCanvasLoadingBar();
        Mautic.stopIconSpinPostEvent();
    },

    /**
     * Moderates intervals to prevent ajax overlaps
     *
     * @param key
     * @param callback
     * @param timeout
     */
    setModeratedInterval: function (key, callback, timeout, params) {
        if (typeof MauticVars.intervalsInProgress[key] != 'undefined') {
            //action is still pending so clear and reschedule
            clearTimeout(MauticVars.moderatedIntervals[key]);
        } else {
            MauticVars.intervalsInProgress[key] = true;

            //perform callback
            if (typeof params == 'undefined') {
                params = [];
            }

            if (typeof callback == 'function') {
                callback(params);
            } else {
                window["Mautic"][callback].apply('window', params);
            }
        }

        //schedule new timeout
        MauticVars.moderatedIntervals[key] = setTimeout(function () {
            Mautic.setModeratedInterval(key, callback, timeout, params)
        }, timeout);
    },

    /**
     * Call at the end of the moderated interval callback function to let setModeratedInterval know
     * the action is done and it's safe to execute again
     *
     * @param key
     */
    moderatedIntervalCallbackIsComplete: function (key) {
        delete MauticVars.intervalsInProgress[key];
    },

    /**
     * Clears a moderated interval
     *
     * @param key
     */
    clearModeratedInterval: function (key) {
        Mautic.moderatedIntervalCallbackIsComplete(key);
        clearTimeout(MauticVars.moderatedIntervals[key]);
        delete MauticVars.moderatedIntervals[key];
    },

    /**
     * Sets flashes
     * @param flashes The flash message HTML to append
     * @param autoClose Optional boolean to determine if the flash should automatically close, defaults to true
     */
    setFlashes: function (flashes, autoClose = true) {
        mQuery('#flashes').append(flashes);

        mQuery('#flashes .alert-new').each(function () {
            var me = this;
            // Only set the timeout if autoClose is true
            if (autoClose) {
                window.setTimeout(function () {
                    mQuery(me).fadeTo(500, 0).slideUp(500, function () {
                        mQuery(this).remove();
                    });
                }, 4000);
            }

            mQuery(this).removeClass('alert-new');
        });
    },

    addFlashMessage: function (message) {
        const elDiv = document.createElement('div');
        elDiv.className = 'alert alert-growl alert-growl--error alert-new';

        const elButton = document.createElement('button');
        elButton.classList.add('close');
        elButton.type = "button";
        elButton.dataset.dismiss = "alert";
        elButton.ariaHidden = "true";
        elButton.ariaLabel = "Close";

        const elI = document.createElement('i');
        elI.className = 'ri-close-line';

        const elSpan = document.createElement('span');
        elSpan.innerHTML = message;

        elButton.append(elI);
        elDiv.append(elButton);
        elDiv.append(elSpan);

        return elDiv;
    },

    addErrorFlashMessage: function(message) {
        return this.addFlashMessage(message);
    },

    addInfoFlashMessage: function(message) {
        const el = this.addFlashMessage(message);
        el.classList.remove('alert-growl--error');
        return el;
    },

    /**
     *
     * @param notifications
     */
    setNotifications: function (notifications) {
        if (notifications.lastId) {
            mQuery('#mauticLastNotificationId').val(notifications.lastId);
        }

        if (mQuery('#notifications .mautic-update')) {
            mQuery('#notifications .mautic-update').remove();
        }

        if (notifications.hasNewNotifications) {
            if (mQuery('#newNotificationIndicator').hasClass('hide')) {
                mQuery('#newNotificationIndicator').removeClass('hide');
            }
        }

        if (notifications.content) {
            mQuery('#notifications').prepend(notifications.content);

            if (!mQuery('#notificationMautibot').hasClass('hide')) {
                mQuery('#notificationMautibot').addClass('hide');
            }
        }
    },

    /**
     * Marks notifications as read and clears unread indicators
     */
    showNotifications: function () {
        mQuery("#notificationsDropdown").off('hide.bs.dropdown');
        mQuery('#notificationsDropdown').on('hidden.bs.dropdown', function () {
            if (!mQuery('#newNotificationIndicator').hasClass('hide')) {
                mQuery('#notifications .is-unread').remove();
                mQuery('#newNotificationIndicator').addClass('hide');
            }
        });
    },

    /**
     * Clear notification(s)
     * @param id
     */
    clearNotification: function (id) {
        if (id) {
            mQuery("#notification" + id).fadeTo("fast", 0.01).slideUp("fast", function () {
                mQuery(this).find("*[data-toggle='tooltip']").tooltip('destroy');
                mQuery(this).remove();

                if (!mQuery('#notifications .notification').length) {
                    if (mQuery('#notificationMautibot').hasClass('hide')) {
                        mQuery('#notificationMautibot').removeClass('hide');
                    }
                }
            });
        } else {
            mQuery("#notifications .notification").fadeOut(300, function () {
                mQuery(this).remove();

                if (mQuery('#notificationMautibot').hasClass('hide')) {
                    mQuery('#notificationMautibot').removeClass('hide');
                }
            });
        }

        mQuery.ajax({
            url: mauticAjaxUrl,
            type: "GET",
            data: "action=clearNotification&id=" + id
        });
    },

    /**
     * Execute an action to AjaxController
     *
     * @param action
     * @param data
     * @param successClosure
     * @param showLoadingBar
     * @param queue
     * @param method
     */
    ajaxActionRequest: function (action, data, successClosure, showLoadingBar, queue, method = "POST") {
        if (typeof Mautic.ajaxActionXhrQueue == 'undefined') {
            Mautic.ajaxActionXhrQueue = {};
        }
        if (typeof Mautic.ajaxActionXhr == 'undefined') {
            Mautic.ajaxActionXhr = {};
        } else if (typeof Mautic.ajaxActionXhr[action] != 'undefined') {
            if (queue) {
                if (typeof Mautic.ajaxActionXhrQueue[action] == 'undefined') {
                    Mautic.ajaxActionXhrQueue[action] = [];
                }

                Mautic.ajaxActionXhrQueue[action].push({action: action, data: data, successClosure: successClosure, showLoadingBar: showLoadingBar, method: method});

                return;
            } else {
                Mautic.removeLabelLoadingIndicator();
                Mautic.ajaxActionXhr[action].abort();
            }
        }

        if (typeof showLoadingBar == 'undefined') {
            showLoadingBar = false;
        }

        Mautic.ajaxActionXhr[action] = mQuery.ajax({
            url: mauticAjaxUrl + '?action=' + action,
            type: method,
            data: data,
            showLoadingBar: showLoadingBar,
            success: function (response) {
                if (typeof successClosure == 'function') {
                    successClosure(response);
                }
            },
            error: function (request, textStatus, errorThrown) {
                Mautic.processAjaxError(request, textStatus, errorThrown, true);
            },
            complete: function () {
                delete Mautic.ajaxActionXhr[action];

                if (typeof Mautic.ajaxActionXhrQueue[action] !== 'undefined' && Mautic.ajaxActionXhrQueue[action].length) {
                    var next = Mautic.ajaxActionXhrQueue[action].shift();

                    Mautic.ajaxActionRequest(next.action, next.data, next.successClosure, next.showLoadingBar, false, next.method);
                }
            }
        });
    },

    /**
     * Check if the browser supports local storage
     *
     * @returns {boolean}
     */
    isLocalStorageSupported: function() {
        try {
            // Check if localStorage is supported
            localStorage.setItem('mautic.test', 'mautic');
            localStorage.removeItem('mautic.test');

            return true;
        } catch (e) {
            return false;
        }
    }
};
