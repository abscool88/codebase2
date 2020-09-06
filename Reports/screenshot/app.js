var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "a0806e951a53922b6f24eba0dd5b881a",
        "instanceId": 2640,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, .\\(\\/\\/\\*\\[\\@class\\=\\'nav-link\\'\\]\\)\\[9\\])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, .\\(\\/\\/\\*\\[\\@class\\=\\'nav-link\\'\\]\\)\\[9\\])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:7:58)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Click on Careers\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:4:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00840021-00eb-0043-0074-0074009d00d9.png",
        "timestamp": 1599417824574,
        "duration": 8144
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "086b2ff4d81f236351cf7817ac6a2a1a",
        "instanceId": 21220,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007a0068-00d0-00ef-006f-00ed000700bc.png",
        "timestamp": 1599417920675,
        "duration": 12369
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "96e6d17ea596f322044240a3ba0c88e0",
        "instanceId": 24464,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006100a7-0013-00fd-004d-00cf002c0098.png",
        "timestamp": 1599418089069,
        "duration": 17368
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "13a951a3e47d662426f8109be61affb8",
        "instanceId": 11800,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008000bf-007a-00be-0070-00f700aa0011.png",
        "timestamp": 1599418239925,
        "duration": 25102
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "35a4236af89c4cfba176d9d7af234c52",
        "instanceId": 21920,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[id=\"\\/\\/a\\[\\@data-toggle\\=\\'modal\\'\\]\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[id=\"\\/\\/a\\[\\@data-toggle\\=\\'modal\\'\\]\"])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:22:16)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Click on Careers\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:4:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "006c0044-00c5-0088-00f9-0075005e00a2.png",
        "timestamp": 1599418937274,
        "duration": 20187
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "dc3a78a2481297103539c5a878809706",
        "instanceId": 34712,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: applyFormPopup.isDisplayed is not a function"
        ],
        "trace": [
            "TypeError: applyFormPopup.isDisplayed is not a function\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:25:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Click on Careers\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:4:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00350040-00ab-008f-0085-007800550091.png",
        "timestamp": 1599419145089,
        "duration": 15
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "0becc6b63c4d73d19bd4c0687ff883bd",
        "instanceId": 36452,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[id=\"\\/\\/a\\[\\@data-toggle\\=\\'modal\\'\\]\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[id=\"\\/\\/a\\[\\@data-toggle\\=\\'modal\\'\\]\"])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:20:16)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Click on Careers\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:4:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d200d3-00b4-0013-0068-00da002300d9.png",
        "timestamp": 1599419184763,
        "duration": 29555
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "6dac698d31cb6dd7b787597c5b6aeb00",
        "instanceId": 4124,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:25:42)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00810004-0009-0091-004b-009500ac0033.png",
        "timestamp": 1599419348126,
        "duration": 21006
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "478db3c0f99ca808fef3356acb43632d",
        "instanceId": 25436,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002a003d-0070-004b-004a-00360048004f.png",
        "timestamp": 1599419516418,
        "duration": 21898
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "15adacd90db7df416b99503422c3275f",
        "instanceId": 25780,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ef00d7-003a-0093-0089-008d00be0067.png",
        "timestamp": 1599419682217,
        "duration": 34070
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "48bd0cf764c5f20211294dc0598d515e",
        "instanceId": 37916,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00450084-00bd-003c-005f-0046001500c6.png",
        "timestamp": 1599419787506,
        "duration": 35953
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "0fcfcfb78d4cde0021ba00219d3d9922",
        "instanceId": 29640,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f00038-0075-0091-004f-003a005600f8.png",
        "timestamp": 1599419852157,
        "duration": 28196
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "2786569cb8f456fc6a77e5e7b806f1ce",
        "instanceId": 33672,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true.",
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:20:32)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:26:42)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00e700c6-0039-00b1-006b-0068006a0073.png",
        "timestamp": 1599419950258,
        "duration": 9159
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "f29a6fd803568f6e01ac39ee9708eac6",
        "instanceId": 33592,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true.",
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:20:33)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:26:43)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00fc00db-00cc-00e2-00d5-0075000a005c.png",
        "timestamp": 1599420127849,
        "duration": 11435
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "cf9fade8d16b8265346680c11a77ab07",
        "instanceId": 21684,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:20:33)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "0005005c-0052-00cf-000d-0064001d00cd.png",
        "timestamp": 1599420176352,
        "duration": 9591
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3dab78bdf49d0c73af5bd44af6e859a2",
        "instanceId": 29404,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00dc006d-00a1-002f-00ae-007400d60081.png",
        "timestamp": 1599420221576,
        "duration": 12738
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2469349b137a89479b866ef562473355",
        "instanceId": 21532,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb0018-0019-0070-00a5-0067001f0037.png",
        "timestamp": 1599420346336,
        "duration": 13245
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3b1a0553e18f1b8af51e37f6d1ccc34b",
        "instanceId": 40260,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0017002b-00f5-0088-008d-0096005c000f.png",
        "timestamp": 1599420568192,
        "duration": 15025
    },
    {
        "description": "Click on Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "38d43a4254a08cbf5ba24760e2a50a1f",
        "instanceId": 31548,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f1002c-009a-00e3-00c7-0032008a0089.png",
        "timestamp": 1599420731779,
        "duration": 14462
    },
    {
        "description": "Test Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d502fa699cf9db2ad5129ca6f932c489",
        "instanceId": 20936,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ea003b-006f-0007-0099-00ee00970080.png",
        "timestamp": 1599421380054,
        "duration": 7970
    },
    {
        "description": "Test SearchJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "d502fa699cf9db2ad5129ca6f932c489",
        "instanceId": 20936,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //*[contains(@href,'careers')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //*[contains(@href,'careers')])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:17:31)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Test SearchJob link\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:14:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c800b2-0053-0040-0027-002f0099002b.png",
        "timestamp": 1599421388627,
        "duration": 317
    },
    {
        "description": "Test BrowseJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "d502fa699cf9db2ad5129ca6f932c489",
        "instanceId": 20936,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, (//*[@class='job-heading'])[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, (//*[@class='job-heading'])[1])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:25:26)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Test BrowseJob link\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:22:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00110023-0098-00ad-00ea-00b600a70020.png",
        "timestamp": 1599421389286,
        "duration": 551
    },
    {
        "description": "Test firstJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "d502fa699cf9db2ad5129ca6f932c489",
        "instanceId": 20936,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:35:42)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "005100b0-00b3-0001-0064-006a00b200d7.png",
        "timestamp": 1599421390163,
        "duration": 2113
    },
    {
        "description": "Test JobForm|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d502fa699cf9db2ad5129ca6f932c489",
        "instanceId": 20936,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0078007e-00c8-008d-001f-009e004000ea.png",
        "timestamp": 1599421392684,
        "duration": 51
    },
    {
        "description": "Test RequiredFields on JobForm link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d502fa699cf9db2ad5129ca6f932c489",
        "instanceId": 20936,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c900e1-0051-00c0-00ff-009300f1005a.png",
        "timestamp": 1599421393040,
        "duration": 1570
    },
    {
        "description": "Test Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c12a3ba369d910a7fc62a72b070cd9f7",
        "instanceId": 29600,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00030040-0000-00fc-008e-00a000bb00b8.png",
        "timestamp": 1599421445017,
        "duration": 8770
    },
    {
        "description": "Test SearchJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c12a3ba369d910a7fc62a72b070cd9f7",
        "instanceId": 29600,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //*[contains(@href,'careers')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //*[contains(@href,'careers')])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:17:31)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Test SearchJob link\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:14:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00910050-00cb-0023-0043-004d00a70013.png",
        "timestamp": 1599421454446,
        "duration": 326
    },
    {
        "description": "Test BrowseJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c12a3ba369d910a7fc62a72b070cd9f7",
        "instanceId": 29600,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, (//*[@class='job-heading'])[1])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, (//*[@class='job-heading'])[1])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:25:26)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Test BrowseJob link\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:22:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e600ea-00d6-00d9-00fd-004f00190078.png",
        "timestamp": 1599421455093,
        "duration": 565
    },
    {
        "description": "Test firstJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c12a3ba369d910a7fc62a72b070cd9f7",
        "instanceId": 29600,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:35:42)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "006200de-007b-0044-000a-001d00a6004d.png",
        "timestamp": 1599421455989,
        "duration": 2117
    },
    {
        "description": "Test JobForm|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c12a3ba369d910a7fc62a72b070cd9f7",
        "instanceId": 29600,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0008002f-0097-0053-00a8-00f600390008.png",
        "timestamp": 1599421458455,
        "duration": 45
    },
    {
        "description": "Test RequiredFields on JobForm link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c12a3ba369d910a7fc62a72b070cd9f7",
        "instanceId": 29600,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00400042-000f-00c6-0004-000700870023.png",
        "timestamp": 1599421458817,
        "duration": 1570
    },
    {
        "description": "Test Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "80698a2de16d6c0f5dffef00bf3b4c53",
        "instanceId": 37216,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008500d6-005d-0026-0036-003e001a008d.png",
        "timestamp": 1599421563498,
        "duration": 9352
    },
    {
        "description": "Test SearchJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "80698a2de16d6c0f5dffef00bf3b4c53",
        "instanceId": 37216,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //*[contains(@href,'careers')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //*[contains(@href,'careers')])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:17:31)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Test SearchJob link\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:14:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00300073-0009-0085-0063-00d800fc00e6.png",
        "timestamp": 1599421573458,
        "duration": 321
    },
    {
        "description": "Test BrowseJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "80698a2de16d6c0f5dffef00bf3b4c53",
        "instanceId": 37216,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:25:41)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "009700f6-00e0-00f8-00a0-00dd00f400f7.png",
        "timestamp": 1599421574109,
        "duration": 2130
    },
    {
        "description": "Test firstJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "80698a2de16d6c0f5dffef00bf3b4c53",
        "instanceId": 37216,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00490010-0045-00ff-00ab-000000c60086.png",
        "timestamp": 1599421576597,
        "duration": 2135
    },
    {
        "description": "Test JobForm|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "80698a2de16d6c0f5dffef00bf3b4c53",
        "instanceId": 37216,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f00b3-008f-0022-00e5-00f000820005.png",
        "timestamp": 1599421579030,
        "duration": 47
    },
    {
        "description": "Test RequiredFields on JobForm link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "80698a2de16d6c0f5dffef00bf3b4c53",
        "instanceId": 37216,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc0007-0032-00b1-00d6-005300710069.png",
        "timestamp": 1599421579383,
        "duration": 1625
    },
    {
        "description": "Test Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "72b31b35a023ddbf4a64111fcd957909",
        "instanceId": 40680,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc00f1-0052-00b1-00b2-0015006b0087.png",
        "timestamp": 1599421673865,
        "duration": 13836
    },
    {
        "description": "Test SearchJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "72b31b35a023ddbf4a64111fcd957909",
        "instanceId": 40680,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: No element found using locator: By(xpath, //*[contains(@href,'careers')])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(xpath, //*[contains(@href,'careers')])\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as isDisplayed] (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:17:31)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Test SearchJob link\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:14:3)\n    at addSpecsToSuite (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0084005f-007b-007d-0037-00c400a8006a.png",
        "timestamp": 1599421688286,
        "duration": 301
    },
    {
        "description": "Test BrowseJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "72b31b35a023ddbf4a64111fcd957909",
        "instanceId": 40680,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:25:41)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00eb0027-0084-00eb-006c-00fa005c0072.png",
        "timestamp": 1599421688908,
        "duration": 2142
    },
    {
        "description": "Test firstJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "72b31b35a023ddbf4a64111fcd957909",
        "instanceId": 40680,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b500b3-00ed-005b-0075-0093008c00e0.png",
        "timestamp": 1599421691384,
        "duration": 2110
    },
    {
        "description": "Test JobForm|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "72b31b35a023ddbf4a64111fcd957909",
        "instanceId": 40680,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b3003f-0014-009f-00f8-00ec00dc00fe.png",
        "timestamp": 1599421693811,
        "duration": 52
    },
    {
        "description": "Test RequiredFields on JobForm link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "72b31b35a023ddbf4a64111fcd957909",
        "instanceId": 40680,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a007e-000c-0057-0048-0091004d0085.png",
        "timestamp": 1599421694163,
        "duration": 1578
    },
    {
        "description": "Test Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ad2af15d08222dd09f91fce8dbb9ff74",
        "instanceId": 29436,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c0098-0021-008a-002c-0041003600d9.png",
        "timestamp": 1599421769991,
        "duration": 8210
    },
    {
        "description": "Test SearchJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ad2af15d08222dd09f91fce8dbb9ff74",
        "instanceId": 29436,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002e0092-00fc-004d-0076-003b00a900a2.png",
        "timestamp": 1599421778799,
        "duration": 144
    },
    {
        "description": "Test BrowseJob link|RegressionSuite",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "ad2af15d08222dd09f91fce8dbb9ff74",
        "instanceId": 29436,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (C:\\Users\\abhishek.ag.gupta\\workspacedemo\\AutomateJobs\\specs.js:25:41)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\abhishek.ag.gupta\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00a70024-0005-00a1-007e-00c900fb00eb.png",
        "timestamp": 1599421779258,
        "duration": 2120
    },
    {
        "description": "Test firstJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ad2af15d08222dd09f91fce8dbb9ff74",
        "instanceId": 29436,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00140061-00f5-0086-0016-009700ec00e9.png",
        "timestamp": 1599421781750,
        "duration": 2125
    },
    {
        "description": "Test JobForm|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ad2af15d08222dd09f91fce8dbb9ff74",
        "instanceId": 29436,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00de006e-0059-0019-00e5-00e700c9000b.png",
        "timestamp": 1599421784196,
        "duration": 43
    },
    {
        "description": "Test RequiredFields on JobForm link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ad2af15d08222dd09f91fce8dbb9ff74",
        "instanceId": 29436,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00550000-0029-000c-00d5-003b00f3007d.png",
        "timestamp": 1599421784558,
        "duration": 1563
    },
    {
        "description": "Test Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3f22ee7c6d9566b175c87add022ab893",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00800051-00ed-00c8-0055-00ab00de00f3.png",
        "timestamp": 1599421825481,
        "duration": 8632
    },
    {
        "description": "Test SearchJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3f22ee7c6d9566b175c87add022ab893",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b500ef-00fa-00bb-0090-00cf00dd0098.png",
        "timestamp": 1599421834742,
        "duration": 137
    },
    {
        "description": "Test BrowseJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3f22ee7c6d9566b175c87add022ab893",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008500ea-0075-00cf-006c-001c004800d7.png",
        "timestamp": 1599421835205,
        "duration": 4118
    },
    {
        "description": "Test firstJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3f22ee7c6d9566b175c87add022ab893",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee0092-00bf-0036-0023-000b00840000.png",
        "timestamp": 1599421839659,
        "duration": 2120
    },
    {
        "description": "Test JobForm|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3f22ee7c6d9566b175c87add022ab893",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001200b5-00f7-00e0-00cd-007f00970073.png",
        "timestamp": 1599421842097,
        "duration": 54
    },
    {
        "description": "Test RequiredFields on JobForm link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3f22ee7c6d9566b175c87add022ab893",
        "instanceId": 12816,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00350003-00a2-0026-0021-004600de00df.png",
        "timestamp": 1599421842455,
        "duration": 1557
    },
    {
        "description": "Test Careers|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "160a3d083f232cc090cde494eed4b39f",
        "instanceId": 29672,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a003a-0001-00f9-00c3-00e600820009.png",
        "timestamp": 1599422313766,
        "duration": 8480
    },
    {
        "description": "Test SearchJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "160a3d083f232cc090cde494eed4b39f",
        "instanceId": 29672,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00800023-0093-0047-0020-009700540017.png",
        "timestamp": 1599422322968,
        "duration": 140
    },
    {
        "description": "Test BrowseJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "160a3d083f232cc090cde494eed4b39f",
        "instanceId": 29672,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008c009e-00db-0008-00f9-005c00b100a8.png",
        "timestamp": 1599422323441,
        "duration": 4098
    },
    {
        "description": "Test firstJob link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "160a3d083f232cc090cde494eed4b39f",
        "instanceId": 29672,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d00b5-0053-0084-002a-00bc008b0040.png",
        "timestamp": 1599422327866,
        "duration": 2117
    },
    {
        "description": "Test JobForm|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "160a3d083f232cc090cde494eed4b39f",
        "instanceId": 29672,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00190051-00f2-00e3-00a0-002a00be0024.png",
        "timestamp": 1599422330307,
        "duration": 41
    },
    {
        "description": "Test RequiredFields on JobForm link|RegressionSuite",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "160a3d083f232cc090cde494eed4b39f",
        "instanceId": 29672,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004800c8-00ce-00a5-0032-00f700960071.png",
        "timestamp": 1599422330644,
        "duration": 1549
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
