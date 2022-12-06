//globals
var language = navigator.language || navigator.userLanguage,
    userAgent = navigator.userAgent || navigator.vendor || window.opera,
    phpsupportglobal,
    titlenode = $("title"),
    ogtitle = $("meta[property='og:title']"),
    html = $("html"),
    body = $("body"),
    main = $("main"),
    paymentpopup = $("#payment"),
    paymentdialogbox = $("#paymentdialogbox"),
    copycontent = $("#copyinput"),
    funk = $("#funk"), // funk sound effect
    cashier = $("#cashier"), // cashier sound effect
    collect = $("#collect"), // collect sound effect
    blip = $("#blip"), // blip sound effect
    waterdrop = $("#waterdrop"), // waterdrop sound effect
    howl = $("#howl"), // howl sound effect
    timezoneoffset = new Date().getTimezoneOffset(),
    timezone = timezoneoffset * 60000,
    scrollposition = 0,
    has_ndef = ("NDEFReader" in window),
    supportsTouch = ("ontouchstart" in window || navigator.msMaxTouchPoints),
    checkcookie = navigator.cookieEnabled,
    referrer,
    referrer = document.referrer,
    isrefferer = (referrer.length > 0),
    is_android_app = (window.matchMedia("(display-mode: standalone)").matches || referrer == "android-app://" + androidpackagename || navigator.standalone), // android app fingerprint
    is_ios_app, // ios app fingerprint
    inframe = (self !== top),
    offline = (navigator.onLine === false),
    w_loc = window.location,
    c_host = w_loc.origin + w_loc.pathname,
    thishostname = w_loc.hostname,
    hostlocation = (thishostname == "" || thishostname == "localhost" || thishostname === "127.0.0.1") ? "local" :
    (thishostname == "bitrequest.github.io") ? "hosted" :
    (thishostname == localhostname) ? "selfhosted" : "unknown",
    symbolcache,
    hascam,
    cp_timer,
    local,
    localserver,
    wl = navigator.wakeLock,
    wakelock,
    bipv,
    bipobj = localStorage.getItem("bitrequest_bpdat"),
    cashier_dat = JSON.parse(localStorage.getItem("bitrequest_cashier")),
    is_cashier = (cashier_dat && cashier_dat.cashier) ? true : false,
    cashier_seedid = (is_cashier) ? cashier_dat.seedid : false,
    hasbip = (bipobj) ? true : false,
    bipid = (hasbip) ? JSON.parse(bipobj).id : false,
    after_poll_timeout = 15000,
    blockswipe,
    ndef,
    ctrl,
    gd_init = false,
    xss_alert = "xss attempt detected";
if (has_ndef && !inframe) {
    var ndef = new NDEFReader();
}

$(document).ready(function() {
    $.ajaxSetup({
        "cache": false
    });
    buildsettings(); // build settings first

    stored_currencies = localStorage.getItem("bitrequest_currencies"),
        init = localStorage.getItem("bitrequest_init"),
        io = (init) ? JSON.parse(init) : {};

    if (hostlocation != "local") { // don't add service worker on desktop
        add_serviceworker();
    }

    //close potential websockets and pings
    forceclosesocket();
    clearpinging();

    //Set classname for ios app	
    if (is_ios_app === true) {
        body.addClass("ios");
    }

    //Set classname for iframe	
    if (inframe === true) {
        html.addClass("inframe hide_app");
    } else {
        html.addClass("noframe");
    }

    //some api tests first
    if (checkcookie === true || inframe === true) { //check for cookie support, tolerate for iframes
        rendersettings(); //retrieve settings from localstorage (load first to retrieve apikey)
        if (typeof(Storage)) { //check for local storage support
            if (!stored_currencies) { //show startpage if no addresses are added
                body.addClass("showstartpage");
            }
            var bipverified = io.bipv,
                phpsupport = io.phpsupport;
            if (bipverified && hasbip === true) {
                bipv = true;
            }
            if (phpsupport) {
                phpsupportglobal = (phpsupport == "yes") ? true : false;
                setsymbols();
            } else {
                checkphp();
            }
        } else {
            var content = "<h2 class='icon-bin'>Sorry!</h2><p>No Web Storage support..</p>";
            popdialog(content, "canceldialog");
        }
    } else {
        var content = "<h2 class='icon-bin'>Sorry!</h2><p>Seems like your browser does not allow cookies...<br/>Please enable cookies if you want to continue using this app.</p>";
        popdialog(content, "canceldialog");
    }
    $("#fixednav").html($("#relnav").html()); // copy nav
    //startscreen
    setTimeout(function() {
        var startscreen = $("#startscreen");
        startscreen.addClass("hidesplashscreen");
        setTimeout(function() {
            startscreen.remove();
        }, 600);
    }, 600);
    showselect();
    selectbox();
    pickselect();
    canceldialogtrigger();
    console.log({
        "config": br_config
    });
})

function checkphp() { //check for php support by fetching fiat currencies from local api php file
    api_proxy({
        "api": "fixer",
        "search": "symbols",
        "cachetime": 86400,
        "cachefolder": "1d",
        "proxy": true,
        "localhost": true,
        "params": {
            "method": "GET"
        }
    }).done(function(e) {
        var result = br_result(e);
        if (result.proxy === true) {
            var data = result.result;
            if (data) {
                var symbols = data.symbols;
                if (symbols) {
                    if (symbols.USD) {
                        localStorage.setItem("bitrequest_symbols", JSON.stringify(symbols));
                    } else {
                        var this_error = (data.error) ? data.error : "Unable to get API data";
                        fail_dialogs("fixer", this_error);
                    }
                }
            }
            io.phpsupport = "yes";
            localStorage.setItem("bitrequest_init", JSON.stringify(io));
            phpsupportglobal = true;
            setsymbols();
        } else {
            io.phpsupport = "no";
            localStorage.setItem("bitrequest_init", JSON.stringify(io));
            phpsupportglobal = false;
            setsymbols();
        }
    }).fail(function(jqXHR, textStatus, errorThrown) {
        io.phpsupport = "no";
        localStorage.setItem("bitrequest_init", JSON.stringify(io));
        phpsupportglobal = false;
        setsymbols();
    });
}

function setsymbols() { //fetch fiat currencies from fixer.io api
    //set globals
    local = (hostlocation == "local" && phpsupportglobal === false),
        localserver = (hostlocation == "local" && phpsupportglobal === true);
    if (localStorage.getItem("bitrequest_symbols")) {
        geterc20tokens();
    } else {
        api_proxy({
            "api": "fixer",
            "search": "symbols",
            "cachetime": 86400,
            "cachefolder": "1d",
            "params": {
                "method": "GET"
            }
        }).done(function(e) {
            var data = br_result(e).result;
            if (data) {
                var symbols = data.symbols;
                if (symbols && symbols.USD) {
                    localStorage.setItem("bitrequest_symbols", JSON.stringify(symbols));
                } else {
                    var this_error = (data.error) ? data.error : "Unable to get API data";
                    fail_dialogs("fixer", this_error);
                }
            }
            geterc20tokens();
        }).fail(function(jqXHR, textStatus, errorThrown) {
            var content = "<h2 class='icon-bin'>Api call failed</h2><p class='doselect'>" + textStatus + "<br/>api did not respond<br/><br/><span id='proxy_dialog' class='ref'>Try other proxy</span></p>";
            popdialog(content, "canceldialog");
        })
    }
}

//* get top 600 erc20 tokens from coinmarketcap
function geterc20tokens() {
    if (localStorage.getItem("bitrequest_erc20tokens")) {
        setfunctions();
    } else {
        api_proxy({
            "api": "coinmarketcap",
            "search": "v1/cryptocurrency/listings/latest?cryptocurrency_type=tokens&limit=600&aux=cmc_rank,platform",
            "cachetime": 604800,
            "cachefolder": "1w",
            "params": {
                "method": "GET"
            }
        }).done(function(e) {
            var data = br_result(e).result,
                status = data.status;
            if (status && status.error_code === 0) {
                storecoindata(data);
                return
            }
            geterc20tokens_local(); // get localy stored coindata
        }).fail(function(jqXHR, textStatus, errorThrown) {
            geterc20tokens_local();
        }).always(function() {
            setfunctions();
        });
    }
}

function geterc20tokens_local() {
    var apiurl = approot + "assets_data_erc20.json";
    $.getJSON(apiurl, function(data) {
        if (data) {
            storecoindata(data);
        }
    }).fail(function(jqXHR, textStatus, errorThrown) {
        var content = "<h2 class='icon-bin'>Api call failed</h2><p class='doselect'>Unable to fetch tokeninfo</p>";
        popdialog(content, "canceldialog");
    });
}

function storecoindata(data) {
    if (data) {
        var erc20push = [];
        $.each(data.data, function(key, value) {
            var platform = value.platform;
            if (platform) {
                if (platform.id === 1027) { // only get erc20 tokens
                    var erc20box = {};
                    erc20box.name = value.slug;
                    erc20box.symbol = value.symbol.toLowerCase();
                    erc20box.cmcid = value.id;
                    erc20box.contract = value.platform.token_address;
                    erc20push.push(erc20box);
                }
            }
        });
        localStorage.setItem("bitrequest_erc20tokens", JSON.stringify(erc20push));
    }
}

function haspin() {
    var pinsettings = $("#pinsettings").data(),
        pinhash = pinsettings.pinhash;
    if (pinhash) {
        var pinstring = pinhash.toString();
        return (pinstring.length > 3 && pinsettings.locktime != "never");
    }
    return false;
}

function islocked() {
    var gets = geturlparameters();
    if (gets == "xss") {
        return true
    }
    var locktime = $("#pinsettings").data("locktime"),
        lastlock = localStorage.getItem("bitrequest_locktime"),
        _now = now(),
        tsll = _now - lastlock,
        pflt = parseFloat(locktime);
    return (gets.payment) ? false : (haspin() === true && tsll > pflt) ? true : false;
}

function setfunctions() {
    setlocales(); //set meta attribute
    //settheme();
    setpermissions();

    // ** Pincode **

    pinkeypress();
    //pinpressselect
    pinpresstrigger();
    //pinpress
    pinvalidatetrigger();
    pin_admin_reset();
    //pinvalidate
    pinbacktrigger();
    pinbackvalidatetrigger();
    //pinback
    canceloptionstrigger();
    //canceloptions
    seed_unlock_trigger();
    phrase_login();
    //remove_rqo
    keyup();
    if (is_viewonly() === true || ishome() === true) {
        finishfunctions();
        return
    }
    if (islocked() === true) {
        var content = pinpanel(" pinwall global");
        showoptions(content, "pin");
        return
    }
    finishfunctions();
}

function finishfunctions() {

    // ** IOS functions **

    //ios_init
    //ios_redirections
    //ios_redirect_bitly

    // ** Intropage **

    starttrigger();
    startnexttrigger();
    //startnext
    //startprev
    lettercountkeydown();
    lettercountinput();
    choosecurrency();

    // ** Navigation **

    togglenav();
    //loadurl
    clicklink();
    //loadpage
    //openpage
    popstate();
    //loadfunction
    //cancel_url_dialogs
    //loadpageevent
    //shownav
    activemenu();
    fixednav();

    // ** Triggerrequest **

    triggertx();
    //triggertxfunction
    confirm_missing_seed();
    //clear_savedurl
    payrequest();

    // ** UX **

    togglecurrency();
    toggleaddress();
    confirm_missing_seed_toggle();
    //cmst_callback
    //cmst_callback
    //add_seed_whitelist
    //seed_wl
    //add_address_whitelist
    //addr_whitelist
    check_pk();
    toggleswitch();
    closeselectbox();
    radio_select();
    dialog_drawer();
    dragstart(); // reorder addresses
    //drag
    dragend();
    //escapeandback
    //close_paymentdialog
    //continue_cpd
    //payment_lookup
    check_recent();
    dismiss_payment_lookup();
    //block_payment_lookup
    request_history();
    //recent_requests
    //recent_requests_list
    //notifications
    //notify
    closenotifytrigger();
    //closenotify
    //topnotify
    //popnotify
    //dialogs
    //popdialog
    //execute
    addcurrencytrigger();
    //addcurrency
    //derive_first_check
    addaddresstrigger();
    //addaddress
    address_xpub_change();
    //active_derives
    get_wallet();
    submitaddresstrigger();
    add_erc20();
    autocomplete_erc20token();
    pickerc20select();
    //initaddressform
    submit_erc20();
    //validateaddress_vk
    //validateaddress
    //check_address
    //check_vk
    send_trigger();
    showbip39_trigger();
    canceldialog_click();
    //canceldialog
    blockcancelpaymentdialog();
    cancelpaymentdialogtrigger();
    //unfocus_inputs
    //cpd_pollcheck
    //cancelpaymentdialog
    //closesocket
    //forceclosesocket
    //clearpinging
    cancelsharedialogtrigger();
    //cancelsharedialog
    showoptionstrigger();
    //showoptions
    //lockscreen
    newrequest_alias();
    newrequest();
    confirm_ms_newrequest();
    //newrequest_cb
    showrequests();
    showrequests_inlne();
    editaddresstrigger();
    removeaddress();
    //removeaddressfunction
    rec_payments();
    showtransaction_trigger();
    showtransactions();
    addressinfo();
    show_pk();
    show_vk();
    //open_blockexplorer_url
    //blockexplorer_url
    //get_blockexplorer
    apisrc_shortcut();

    // ** Requestlist functions **

    showrequestdetails();
    toggle_request_meta();
    //animate_confbar
    show_transaction_meta();
    hide_transaction_meta();
    archive();
    //archivefunction
    unarchive();
    //unarchivefunction
    removerequest();
    //removerequestfunction

    // ** Helpers **

    open_url();
    //get_blockcypher_apikey
    //get_amberdata_apikey
    //get_infura_apikey
    //api_proxy
    //result
    //get_api_url
    //fetchsymbol
    //fixedcheck
    //geturlparameters
    //xss_search
    //ishome
    //triggersubmit
    //copytoclipboard
    //getrandomnumber
    //hashcode
    //loader
    closeloader_trigger();
    //closeloader
    //loadertext
    //settitle
    //getcc_icon
    //getdevicetype
    //getplatform
    //makedatestring
    //short_date
    //returntimestamp
    //to_ts
    //weekdays
    //fulldateformat
    //fulldateformatmarkup
    //formattime
    //playsound
    //vibrate
    //get_api_data
    //pinpanel
    //switchpanel
    //getcoindata
    //activecoinsettings
    //getcoinsettings
    //getbip32dat
    //getcoinconfig
    //try_next_api
    //wake
    //sleep
    //vu_block
    //trimdecimals
    //countdown
    //countdown_format
    //adjust_objectarray

    // ** Page rendering **

    rendercurrencies();
    setTimeout(function() {
        loadurl(); //initiate page
    }, 100);
    //render_currencysettings
    //rendersettings
    renderrequests();
    //archive_button
    //fetchrequests
    //initiate
    //buildpage
    //append_coinsetting
    //appendaddress
    //appendrequest
    receipt();
    download_receipt();
    share_receipt();
    //lnd_lookup_invoice
    //get_pdf_url;
    //amountshort
    editrequest();
    submit_request_description();

    // ** Store data in localstorage **

    //savecurrencies
    //saveaddresses
    //saverequests
    //savearchive
    //savesettings
    //save_cc_settings
    //updatechanges
    //resetchanges
    //savechangesstats
    renderchanges();
    //change_alert
    //get_total_changes

    // ** Get_app **

    setTimeout(function() { // wait for ios app detection
        detectapp();
    }, 700);

    //getapp
    close_app_panel();
    //platform_icon
    //fetch_aws

    // ** HTML rendering **

    //render_html
    //render_attributes

    // ** HTML templates **

    //template_dialog

    // Query helpers

    //exists
    //now
    //shake
    //get_setting
    //set_setting
    //get_requestli
    //get_addresslist
    //filter_addressli
    //filter_all_addressli
    //filter_list
    //dom_to_array
    //get_latest_index
    //check_currency
    //currency_check
    //currency_uncheck
    //d_proxy
    //get_vk
    gk();
    html.addClass("loaded");
    check_rr();
    //toggle_rr
}

//checks

function setlocales() {
    html.attr("lang", language);
    $("meta[property='og:locale']").attr("content", language);
    $("meta[property='og:url']").attr("content", w_loc.href);
}

function settheme() {
    var theme_settings = $("#themesettings").data("selected");
    if (theme_settings) {
        $("#theme").attr("href", "assets/styles/themes/" + theme_settings);
    }
}

function setpermissions() {
    var permission = $("#permissions").data("selected");
    html.attr("data-role", permission);
}

function is_viewonly() {
    var permission = $("#permissions").data("selected");
    return (permission == "cashier");
}

// ** Pincode **

function pinkeypress() {
    $(document).keydown(function(e) {
        var pinfloat = $("#pinfloat");
        if (pinfloat.length) {
            var keycode = e.keyCode;
            if (keycode === 49 || keycode === 97) {
                pinpressselect($("#pin1 > span"));
            } else if (keycode === 50 || keycode === 98) {
                pinpressselect($("#pin2 > span"));
            } else if (keycode === 51 || keycode === 99) {
                pinpressselect($("#pin3 > span"));
            } else if (keycode === 52 || keycode === 100) {
                pinpressselect($("#pin4 > span"));
            } else if (keycode === 53 || keycode === 101) {
                pinpressselect($("#pin5 > span"));
            } else if (keycode === 54 || keycode === 102) {
                pinpressselect($("#pin6 > span"));
            } else if (keycode === 55 || keycode === 103) {
                pinpressselect($("#pin7 > span"));
            } else if (keycode === 56 || keycode === 104) {
                pinpressselect($("#pin8 > span"));
            } else if (keycode === 57 || keycode === 105) {
                pinpressselect($("#pin9 > span"));
            } else if (keycode === 48 || keycode === 96) {
                pinpressselect($("#pin0 > span"));
            } else if (keycode === 8) {
                if (pinfloat.hasClass("enterpin")) {
                    pinback($("#pininput"));
                } else {
                    pinback($("#validatepin"));
                }
            }
        }
    });
}

function pinpressselect(node) {
    if ($("#pinfloat").hasClass("enterpin")) {
        pinpress(node);
        return
    }
    pinvalidate(node)
}

function pinpresstrigger() {
    $(document).on("click", "#optionspop .enterpin .pinpad .pincell", function() {
        pinpress($(this));
    });
}

function pinpress(thispad) {
    var pinfloat = $("#pinfloat"),
        thisval = thispad.text(),
        pininput = $("#pininput"),
        pinval = pininput.val(),
        newval = pinval + thisval;
    if (newval.length === 4) {
        if (pinfloat.hasClass("pinwall")) {
            enterapp(newval);
            pininput.val(newval);
            return false;
        }
        pininput.val(newval);
        setTimeout(function() {
            pinfloat.addClass("validatepin").removeClass("enterpin");
        }, 100);
        return false;
    }
    if (newval.length > 4) {
        return false;
    }
    pininput.val(newval);
    thispad.addClass("activepad");
    setTimeout(function() {
        thispad.removeClass("activepad");
    }, 500);
    $("#pincode .pinpad").not(thispad).removeClass("activepad");
}

function enterapp(pinval) {
    var pinfloat = $("#pinfloat"),
        pinsettings = $("#pinsettings").data(),
        savedpin = pinsettings.pinhash,
        attempts = pinsettings.attempts,
        hashpin = hashcode(pinval),
        _now = now(),
        timeout,
        global = (pinfloat.hasClass("global")) ? true : false;
    if (hashpin == savedpin) {
        if (global) {
            var nit = true;
            localStorage.setItem("bitrequest_locktime", _now);
            finishfunctions();
            setTimeout(function() {
                playsound(waterdrop);
                canceloptions(true);
            }, 500);
        } else if (pinfloat.hasClass("admin")) {
            localStorage.setItem("bitrequest_locktime", _now);
            loadpage("?p=currencies");
            $(".currenciesbttn .self").addClass("activemenu");
            playsound(waterdrop);
            canceloptions(true);
        } else if (pinfloat.hasClass("reset")) {
            localStorage.setItem("bitrequest_locktime", _now);
            $("#pintext").text("Enter new pin");
            pinfloat.addClass("p_admin").removeClass("pinwall reset");
            playsound(waterdrop);
            setTimeout(function() {
                $("#pininput").val("");
            }, 200);
        } else {
            var callback = pinfloat.data("pincb");
            if (callback) {
                callback.func(callback.args);
            } else {
                localStorage.setItem("bitrequest_locktime", _now);
            }
            playsound(waterdrop);
            canceloptions(true);
        }
        pinsettings.attempts = 0;
        savesettings(global);
        remove_cashier();
    } else {
        if (navigator.vibrate) {} else {
            playsound(funk);
        }
        shake(pinfloat);
        setTimeout(function() {
            $("#pininput").val("");
        }, 10);
        if (attempts > 2) {
            if (attempts === 3) {
                var timeout = _now + 300000; // 5 minutes
                pinsettings.timeout = timeout;
                lockscreen(timeout);
            } else if (attempts === 6) {
                var timeout = _now + 1800000; // 30 minutes
                pinsettings.timeout = timeout;
                lockscreen(timeout);
            } else if (attempts === 9) {
                var timeout = _now + 86400000; // 24 hours
                pinsettings.timeout = timeout;
                lockscreen(timeout);
            } else if (attempts > 9) {
                attempts = 1;
            }
        }
        pinsettings.attempts = attempts + 1;
        savesettings(global);
    }
}

function clearpinlock() {
    var pinsettings = $("#pinsettings").data();
    pinsettings.timeout = null;
    pinsettings.attempts = 0;
    savesettings();
}

function pin_admin_reset() {
    $(document).on("click", "#reset_pin", function() {
        $("#pinfloat").removeClass("p_admin");
    });
}

function pinvalidatetrigger() {
    $(document).on("click", "#optionspop .validatepin .pinpad .pincell", function() {
        pinvalidate($(this))
    });
}

function pinvalidate(thispad) {
    var pinfloat = $("#pinfloat"),
        thisval = thispad.text(),
        pininput = $("#validatepin"),
        pinval = pininput.val(),
        newval = pinval + thisval;
    if (newval.length > 3) {
        if (newval == $("#pininput").val()) {
            var current_pin = get_setting("pinsettings", "pinhash"),
                pinsettings = $("#pinsettings"),
                pinhash = hashcode(newval),
                titlepin = "pincode activated",
                locktime = pinsettings.data("locktime");
            pinsettings.data({
                "pinhash": pinhash,
                "locktime": locktime,
                "selected": titlepin
            }).find("p").text(titlepin);
            savesettings();
            playsound(waterdrop);
            canceloptions(true);
            var callback = pinfloat.data("pincb");
            if (callback) {
                callback.func(callback.args);
            }
            notify("Data saved");
            enc_s(seed_decrypt(current_pin));
        } else {
            var pinfloat = $("#pinfloat");
            topnotify("pincode does not match");
            if (navigator.vibrate) {} else {
                playsound(funk);
            }
            shake(pinfloat);
            pininput.val("");
        }
    }
    if (newval.length > 4) {
        return false;
    }
    pininput.val(newval);
    thispad.addClass("activepad");
    setTimeout(function() {
        thispad.removeClass("activepad");
    }, 500);
    $("#pincode .pinpad").not(thispad).removeClass("activepad");
}

function pinbacktrigger() {
    $(document).on("click", "#optionspop #pinfloat.enterpin #pinback", function() {
        pinback($("#pininput"));
    });
}

function pinbackvalidatetrigger() {
    $(document).on("click", "#optionspop #pinfloat.validatepin #pinback", function() {
        pinback($("#validatepin"));
    });
}

function pinback(pininput) {
    var pinval = pininput.val(),
        inputlength = pinval.length,
        prevval = pinval.substring(0, inputlength - 1);
    pininput.val(prevval);
}

// ** IOS Redirects **

// (Can only be envoked from the IOS app) 

//Set classname for ios app

function ios_init() {
    is_ios_app = true;
    body.addClass("ios"); // ios app fingerprint
}

function ios_redirections(url) {
    if (url.endsWith("4bR")) { // handle bitly shortlink
        ios_redirect_bitly(url);
        return
    }
    var currenturlvar = w_loc.href,
        currenturl = currenturlvar.toUpperCase(),
        newpage = url.toUpperCase();
    if (currenturl == newpage) {
        return
    }
    var isrequest = (newpage.indexOf("PAYMENT=") >= 0);
    if (isrequest === true) {
        var isopenrequest = (currenturl.indexOf("PAYMENT=") >= 0);
        if (isopenrequest === true) {
            cancelpaymentdialog();
            setTimeout(function() {
                openpage(url, "", "payment");
            }, 1000);
        } else {
            openpage(url, "", "payment");
        }
    } else {
        var slice = url.slice(url.lastIndexOf("?p=") + 3),
            pagename = (slice.indexOf("&") >= 0) ? slice.substr(0, slice.indexOf("&")) : slice;
        openpage(url, pagename, "page");
    }
    updaterequeststatesrefresh();
}

function ios_redirect_bitly(shorturl) {
    if (hostlocation == "local") {} else {
        var bitly_id = shorturl.split(approot)[1].split("4bR")[0],
            getcache = sessionStorage.getItem("bitrequest_longurl_" + bitly_id);
        if (getcache) { // check for cached values
            ios_redirections(getcache);
        } else {
            api_proxy({
                "api": "bitly",
                "search": "expand",
                "cachetime": 84600,
                "cachefolder": "1d",
                "bearer": true,
                "params": {
                    "method": "POST",
                    "contentType": "application/json",
                    "data": JSON.stringify({
                        "bitlink_id": "bit.ly/" + bitly_id
                    })
                }
            }).done(function(e) {
                var data = br_result(e).result;
                if (data.error) {
                    fail_dialogs("bitly", data.error);
                } else {
                    if (data) {
                        var longurl = data.long_url;
                        if (longurl) {
                            ios_redirections(longurl);
                            sessionStorage.setItem("bitrequest_longurl_" + bitly_id, longurl); //cache token decimals
                        } else {
                            w_loc.href = "http://bit.ly/" + bitly_id;
                        }
                    }
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                w_loc.href = "http://bit.ly/" + bitly_id;
            });
        }
    }
}

// ** Intropage **

function starttrigger() {
    $(document).on("click touchend", "#intro .panelwrap, #intro .proceeed", function() {
        startnext($("#intro"));
    });
}

function startnexttrigger() {
    $(document).on("click touchend", "#entername .panelwrap", function(e) {
        if (e.target == this) {
            startnext($("#entername"));
        }
    });
}

function startnext(thisnode) {
    var thisnext = thisnode.attr("data-next");
    if (thisnext === undefined) {
        return
    }
    if (thisnode.hasClass("validstep")) {
        $("#startpage").attr("class", "sp_" + thisnext);
        thisnode.removeClass("panelactive").next(".startpanel").addClass("panelactive");
        $("#eninput").blur();
        return
    }
    topnotify("Please enter your name");
}

function startprev(thisnode) {
    var thisprev = thisnode.attr("data-prev");
    if (thisprev === undefined) {
        return
    }
    $("#startpage").attr("class", "sp_" + thisprev);
    thisnode.removeClass("panelactive").prev(".startpanel").addClass("panelactive");
    $("#eninput").blur();
}

function lettercountkeydown() { // Character limit on input field
    $(document).on("keydown", "#eninput", function(e) {
        var keycode = e.keyCode,
            thisinput = $(this),
            thisvallength = thisinput.val().length,
            lettersleft = thisinput.attr("data-max") - thisvallength;
        if (keycode === 13) {
            startnext($("#entername"));
        }
        if (keycode === 8 || keycode === 39 || keycode === 37 || keycode === 91 || keycode === 17 || e.metaKey || e.ctrlKey) { //alow backspace, arrowright, arrowleft, command, ctrl
            return
        }
        if (lettersleft === 0) {
            playsound(funk);
            e.preventDefault();
        }
    });
}

function lettercountinput() { // Character count plus validation
    $(document).on("input", "#eninput", function() {
        var thisinput = $(this),
            mininput = thisinput.attr("data-min"),
            thispanel = $("#entername"),
            thisvallength = thisinput.val().length,
            lettersleft = thisinput.attr("data-max") - thisvallength,
            lettercount = $("#lettercount");
        lettercount.text(lettersleft);
        if (thisvallength >= mininput) {
            thispanel.addClass("validstep");
        } else {
            thispanel.removeClass("validstep");
        }
        if (thisvallength < 1) {
            lettercount.removeClass("activlc");
        } else {
            lettercount.addClass("activlc");
        }
    });
}

function choosecurrency() {
    $(document).on("click touch", "#allcurrencies li.choose_currency", function() {
        var currency = $(this).attr("data-currency"),
            cd = getcoindata(currency);
        addaddress({
            "currency": currency,
            "ccsymbol": cd.ccsymbol,
            "cmcid": cd.cmcid,
            "erc20": false,
            "checked": true
        }, false);
    })
}

// ** Navigation **

function togglenav() {
    $(document).on("click", "#header", function() {
        if (html.hasClass("showmain")) {
            loadpage("?p=home");
            $(".navstyle li .self").removeClass("activemenu");
            return
        }
        if (islocked() === true) {
            if (is_viewonly() === true) {
                loadpage("?p=currencies");
                $(".currenciesbttn .self").addClass("activemenu");
                return
            }
            var content = pinpanel(" pinwall admin");
            showoptions(content, "pin");
            return
        }
        loadpage("?p=currencies");
        $(".currenciesbttn .self").addClass("activemenu");
    });
}

function loadurl() {
    var gets = geturlparameters();
    if (gets == "xss") {
        loadpageevent("home");
        return
    }
    var page = gets.p,
        payment = gets.payment,
        url = w_loc.search,
        event = (payment) ? "both" : "loadpage";
    if (url) {
        openpage(url, page, event);
    } else {
        loadpageevent("home");
    }
    shownav(page);
    var bip39info = gets.bip39;
    if (bip39info) {
        bip39_sc(bip39info);
    }
}

function clicklink() {
    $(document).on("click", ".self", function(e) {
        e.preventDefault();
        loadpage($(this).attr("data-rel"));
        return
    })
}

//push history and set current page
function loadpage(href) {
    var pagename = href.split("&")[0].split("=").pop();
    openpage(href, pagename, "loadpage");
}

function openpage(href, pagename, event) {
    history.pushState({
        "pagename": pagename,
        "event": event
    }, "", href);
    loadfunction(pagename, event);
}

function popstate() {
    window.onpopstate = function(e) {
        var statemeta = e.state;
        if (statemeta && statemeta.pagename) { //check for history
            loadfunction(statemeta.pagename, statemeta.event);
            return
        }
        cancel_url_dialogs();
    }
}
//activate page
function loadfunction(pagename, thisevent) {
    if (thisevent == "payment") { //load paymentpopup if payment is set
        loadpaymentfunction();
        return
    }
    if (thisevent == "both") { //load paymentpopup if payment is set and load page
        loadpageevent(pagename);
        setTimeout(function() {
            loadpaymentfunction("delay");
        }, 1000);
        return
    }
    loadpageevent(pagename);
    var title = pagename + " | " + apptitle;
    settitle(title);
    cancel_url_dialogs();
}

function cancel_url_dialogs() {
    if (paymentpopup.hasClass("active")) {
        cancelpaymentdialog();
    }
    if (body.hasClass("showcam")) {
        $("#closecam").trigger("click");
    }
}

function loadpageevent(pagename) {
    $("html, body").animate({
        "scrollTop": 0
    }, 400);
    var currentpage = $("#" + pagename);
    currentpage.addClass("currentpage");
    $(".page").not(currentpage).removeClass("currentpage");
    $(".highlightbar").attr("data-class", pagename);
    shownav(pagename);
    var requestfilter = geturlparameters().filteraddress; // filter requests if filter parameter exists
    if (requestfilter && pagename == "requests") {
        $("#requestlist > li").not(get_requestli("address", requestfilter)).hide();
    } else {
        $("#requestlist > li").show();
    }
}

function shownav(pagename) { // show / hide navigation
    if (ishome(pagename) === true) {
        html.removeClass("showmain").addClass("hidemain");
        $("#relnav .nav").slideUp(300);
        return
    }
    html.addClass("showmain").removeClass("hidemain")
    $("#relnav .nav").slideDown(300);
}

function activemenu() {
    $(document).on("click", ".nav li .self", function() {
        var thisitem = $(this);
        thisitem.addClass("activemenu");
        $(".nav li .self").not(thisitem).removeClass("activemenu");
        return
    })
}

function fixednav() {
    $(document).scroll(function(e) {
        if (html.hasClass("paymode")) {
            e.preventDefault();
            return
        }
        fixedcheck($(document).scrollTop());
    });
}

// ** Triggerrequest **

function triggertx() {
    $(document).on("click", ".currencylist li > .rq_icon", function() {
        triggertxfunction($(this));
        canceloptions();
    });
}

function triggertxfunction(thislink) {
    var currency = thislink.data("currency"),
        can_derive = derive_first_check(currency);
    if (can_derive === true) {
        triggertxfunction(thislink);
        return
    }
    var pick_random = cs_dat(currency, "Use random address").selected,
        derives = check_derivations(currency),
        addresslist = filter_addressli(currency, "checked", true),
        firstlist = addresslist.first(),
        manualist = addresslist.not(".seed"),
        addresscount = manualist.length,
        randomlist = (addresscount > 1) ? manualist : firstlist,
        random = getrandomnumber(1, addresscount) - 1,
        pick_address = (pick_random === true) ? (firstlist.hasClass("seed")) ? firstlist : manualist.eq(random) : firstlist,
        a_data = pick_address.data(),
        thisaddress = a_data.address,
        title = thislink.attr("title"),
        savedurl = thislink.data("url"),
        seedid = a_data.seedid;
    if (seedid) {
        if (seedid != bipid) {
            if (addr_whitelist(thisaddress) === true) {} else {
                var pass_dat = {
                        "currency": currency,
                        "address": thisaddress,
                        "url": savedurl,
                        "title": title,
                        "seedid": seedid
                    },
                    content = get_address_warning("addresswarning", thisaddress, pass_dat);
                popdialog(content, "triggersubmit");
                return false;
            }
        } else {
            if (bipv_pass() === false) {
                return false;
            }
        }
    }
    finishtxfunction(currency, thisaddress, savedurl, title)
}

function confirm_missing_seed() {
    $(document).on("click", "#addresswarning .submit", function(e) {
        e.preventDefault();
        var thisdialog = $("#addresswarning"),
            d_dat = thisdialog.data(),
            pk_checkbox = thisdialog.find("#pk_confirmwrap"),
            pk_checked = pk_checkbox.data("checked"),
            ds_checkbox = thisdialog.find("#dontshowwrap"),
            ds_checked = ds_checkbox.data("checked");
        if (pk_checked == true) {} else {
            popnotify("error", "Confirm privatekey ownership");
            return false
        }
        if (ds_checked == true) { // whitlist seed id
            add_address_whitelist(d_dat.address);
        }
        canceldialog();
        finishtxfunction(d_dat.currency, d_dat.address, d_dat.url, d_dat.title);
        return false;
    })
}

function get_address_warning(id, address, pass_dat) {
    var seedstr = (pass_dat.xpubid) ? "Xpub" : "Seed",
        rest_str = (seedstr == "Seed") ? (hasbip === true) ? "" : "<div id='rest_seed' class='ref' data-seedid='" + pass_dat.seedid + "'>Restore seed</div>" : "";
    return $("<div class='formbox addwarning' id='" + id + "'>\
		<h2 class='icon-warning'>Warning!</h2>\
		<div class='popnotify'></div>\
		<p><strong>" + seedstr + " for '<span class='adspan'>" + address + "</span>' is missing.<br/>Are you sure you want to use this address?</strong></p>\
		<form class='addressform popform'>\
			<div class='inputwrap'>\
				<div class='pk_wrap noselect'>\
					<div id='pk_confirmwrap' class='cb_wrap' data-checked='false'><span class='checkbox'></span></div>\
					<span>I own the seed / private key of this address</span>\
				</div>\
				<div class='pk_wrap noselect'>\
					<div id='dontshowwrap' class='cb_wrap' data-checked='false'><span class='checkbox'></span></div>\
					<span>Don't show again</span>\
				</div>" + rest_str +
        "</div>\
			<input type='submit' class='submit' value='OK'>\
		</form>\
	</div>").data(pass_dat);
}

function finishtxfunction(currency, thisaddress, savedurl, title) {
    var cd = getcoindata(currency),
        currencysettings = $("#currencysettings").data(),
        c_default = currencysettings.default,
        currencysymbol = (c_default === true && offline === false) ? currencysettings.currencysymbol : cd.ccsymbol,
        currentpage = geturlparameters().p,
        currentpage_correct = (currentpage) ? "?p=" + currentpage + "&payment=" : "?payment=",
        prefix = currentpage_correct + currency + "&uoa=",
        newlink = prefix + currencysymbol + "&amount=0" + "&address=" + thisaddress,
        href = (!savedurl || offline !== false) ? newlink : savedurl, //load saved url if exists
        thistitle = (title) ? title : "bitrequest";
    localStorage.setItem("bitrequest_editurl", href); // to check if request is being edited
    remove_flip(); // reset request card facing front
    openpage(href, thistitle, "payment");
}

function clear_savedurl() {
    $("#currencylist li > .rq_icon").removeData("url");
}

function payrequest() {
    $(document).on("click", "#requestlist .req_actions .icon-qrcode, #requestlist .payrequest", function(e) {
        e.preventDefault();
        var thisnode = $(this);
        if (offline === true && thisnode.hasClass("isfiat")) {
            // do not trigger fiat request when offline because of unknown exchange rate
            notify("Unable to get exchange rate");
            return
        }
        var thisrequestlist = thisnode.closest("li.rqli"),
            rldata = thisrequestlist.data(),
            rl_payment = rldata.payment,
            rl_uoa = rldata.uoa,
            rl_status = rldata.status,
            rl_requesttype = rldata.requesttype,
            rl_amount = rldata.amount,
            rl_receivedamount = rldata.receivedamount,
            rl_fiatvalue = rldata.fiatvalue,
            rl_iscrypto = rldata.iscrypto,
            rl_uoa = rldata.uoa,
            insufficient = (rl_status == "insufficient"),
            midstring = thisnode.attr("data-rel"),
            endstring = "&status=" + rl_status + "&type=" + rl_requesttype,
            amount_short_rounded = amountshort(rl_amount, rl_receivedamount, rl_fiatvalue, rl_iscrypto),
            paymenturl_amount = (insufficient === true) ? amount_short_rounded : rl_amount,
            lightning = rldata.lightning,
            d = (lightning && lightning.invoice) ? "&d=" + btoa(JSON.stringify({
                "imp": lightning.imp,
                "proxy": lightning.proxy_host,
                "nid": lightning.nid,
                "lid": lightning.pid
            })) : "",
            paymenturl = "?p=requests&payment=" + rl_payment + "&uoa=" + rl_uoa + "&amount=" + paymenturl_amount + midstring + endstring + d;
        openpage(paymenturl, "", "payment");
        return
    });
}

// ** UX **

function togglecurrency() {
    $(document).on("click", ".togglecurrency", function() {
        var parentlistitem = $(this).closest("li"),
            coindata = parentlistitem.data(),
            currency = coindata.currency,
            checked = coindata.checked,
            currencylistitem = $("#currencylist > li[data-currency='" + currency + "']");
        if (checked === true) {
            parentlistitem.attr("data-checked", "false").data("checked", false);
            currencylistitem.addClass("hide");
        } else {
            var lscurrency = localStorage.getItem("bitrequest_cc_" + currency);
            if (lscurrency) {
                var addresslist = get_addresslist(currency),
                    addresscount = addresslist.find("li[data-checked='true']").length;
                if (addresscount == 0) {
                    addresslist.find("li[data-checked='false']").first().find(".toggleaddress").trigger("click");
                } else {
                    parentlistitem.attr("data-checked", "true").data("checked", true);
                    currencylistitem.removeClass("hide");
                }
            } else {
                addcurrency(coindata);
            }
        }
        savecurrencies(false);
    });
}

function toggleaddress() {
    $(document).on("click", ".toggleaddress", function() {
        var parentlistitem = $(this).closest("li"),
            checked = parentlistitem.data("checked"),
            parentlist = parentlistitem.closest("ul.pobox"),
            addresscount = parentlist.find("li[data-checked='true']").length,
            currency = parentlist.attr("data-currency");
        if (checked === true || checked == "true") {
            parentlistitem.attr("data-checked", "false").data("checked", false);
        } else {
            var a_dat = parentlistitem.data();
            if (parentlistitem.hasClass("seedu")) {
                var address = a_dat.address,
                    seedid = a_dat.seedid;
                if (addr_whitelist(address) === true) {} else {
                    var pass_dat = {
                            "address": address,
                            "pli": parentlistitem,
                            "seedid": seedid
                        },
                        content = get_address_warning("addresswarningcheck", address, pass_dat);
                    popdialog(content, "triggersubmit");
                    return
                }
            } else if (parentlistitem.hasClass("xpubu")) {
                var address = a_dat.address;
                if (addr_whitelist(address) === true) {} else {
                    var haspub = has_xpub(currency),
                        xpubid = a_dat.xpubid;
                    if (haspub === false || (haspub && haspub.key_id != xpubid)) {
                        var pass_dat = {
                                "address": address,
                                "pli": parentlistitem,
                                "xpubid": xpubid
                            },
                            content = get_address_warning("addresswarningcheck", address, pass_dat);
                        popdialog(content, "triggersubmit");
                        return
                    }
                }
            }
            parentlistitem.attr("data-checked", "true").data("checked", true);
        }
        saveaddresses(currency, false);
        check_currency(currency);
        clear_savedurl();
    });
}

function confirm_missing_seed_toggle() {
    $(document).on("click", "#addresswarningcheck .submit", function(e) {
        e.preventDefault();
        var thisdialog = $("#addresswarningcheck"),
            d_dat = thisdialog.data(),
            pk_checkbox = thisdialog.find("#pk_confirmwrap"),
            pk_checked = pk_checkbox.data("checked"),
            ds_checkbox = thisdialog.find("#dontshowwrap"),
            ds_checked = ds_checkbox.data("checked");
        if (pk_checked == true) {} else {
            popnotify("error", "Confirm privatekey ownership");
            return
        }
        if (ds_checked == true) { // whitlist seed id
            add_address_whitelist(d_dat.address);
        }
        canceldialog();
        cmst_callback(d_dat.pli);
        return
    })
}

function cmst_callback(parentlistitem) {
    var parentlist = parentlistitem.closest("ul.pobox"),
        currency = parentlist.attr("data-currency");
    parentlistitem.attr("data-checked", "true").data("checked", true);
    check_currency(currency);
    saveaddresses(currency, false);
    clear_savedurl();
}

function add_seed_whitelist(seedid) {
    var stored_whitelist = localStorage.getItem("bitrequest_swl"),
        seed_whitelist = (stored_whitelist) ? JSON.parse(stored_whitelist) : [];
    if ($.inArray(seedid, seed_whitelist) === -1) {
        seed_whitelist.push(seedid);
    }
    localStorage.setItem("bitrequest_swl", JSON.stringify(seed_whitelist));
}

function seed_wl(seedid) {
    var stored_whitelist = localStorage.getItem("bitrequest_swl"),
        seed_whitelist = (stored_whitelist) ? JSON.parse(stored_whitelist) : [];
    return ($.inArray(seedid, seed_whitelist) === -1) ? false : true;
}

function add_address_whitelist(address) {
    var stored_whitelist = localStorage.getItem("bitrequest_awl"),
        address_whitelist = (stored_whitelist) ? JSON.parse(stored_whitelist) : [];
    if ($.inArray(address, address_whitelist) === -1) {
        address_whitelist.push(address);
    }
    localStorage.setItem("bitrequest_awl", JSON.stringify(address_whitelist));
}

function addr_whitelist(address) {
    var stored_whitelist = localStorage.getItem("bitrequest_awl"),
        address_whitelist = (stored_whitelist) ? JSON.parse(stored_whitelist) : [];
    return ($.inArray(address, address_whitelist) === -1) ? false : true;
}

function check_pk() {
    $(document).on("click", "#popup .cb_wrap", function() {
        var thisnode = $(this),
            checked = thisnode.data("checked");
        if (checked == true) {
            thisnode.attr("data-checked", "false").data("checked", false);
        } else {
            thisnode.attr("data-checked", "true").data("checked", true);
        }
    });
}

function toggleswitch() {
    $(document).on("mousedown", ".switchpanel.global", function() {
        var thistoggle = $(this);
        if (thistoggle.hasClass("true")) {
            thistoggle.removeClass("true").addClass("false");
        } else {
            thistoggle.removeClass("false").addClass("true");
        }
    })
}

// ** Selectbox **

function showselect() {
    $(document).on("click", ".selectarrows", function() {
        var options = $(this).next(".options");
        if (options.hasClass("showoptions")) {
            options.removeClass("showoptions");
        } else {
            options.addClass("showoptions");
        }
    });
}

function selectbox() {
    $(document).on("click", ".selectbox > input:not([readonly])", function() {
        var thisselect = $(this),
            thisvalue = thisselect.val(),
            options = thisselect.parent(".selectbox").find(".options span");
        if (options.hasClass("show")) {
            options.removeClass("show");
        } else {
            options.filter(function() {
                return $(this).text() != thisvalue;
            }).addClass("show");
        }
    })
}

function pickselect() {
    $(document).on("click", ".selectbox > .options span", function() {
        var thisselect = $(this),
            thisvalue = thisselect.text(),
            thisdata = thisselect.data(),
            selectbox = thisselect.closest(".selectbox"),
            thisinput = selectbox.children("input");
        thisinput.val(thisvalue).data(thisdata);
        selectbox.find(".options").removeClass("showoptions").children("span").removeClass("show");
    })
}

function closeselectbox() {
    $("#popup .selectbox .options").removeClass("showoptions");
}

function radio_select() {
    $(document).on("click", ".formbox .pick_conf", function() {
        var thistrigger = $(this),
            thisradio = thistrigger.find(".radio");
        if (thisradio.hasClass("icon-radio-unchecked")) {
            $(".formbox .conf_options .radio").not(thisradio).removeClass("icon-radio-checked2").addClass("icon-radio-unchecked")
            thisradio.removeClass("icon-radio-unchecked").addClass("icon-radio-checked2");
        } else {
            thisradio.removeClass("icon-radio-checked2").addClass("icon-radio-unchecked");
        }
        var thisvalue = thistrigger.children("span").text(),
            thisinput = $(".formbox input:first");
        thisinput.val(thisvalue);
    })
}

function dialog_drawer() {
    $(document).on("click", "#ad_info_wrap .d_trigger", function() {
        var thistrigger = $(this),
            drawer = thistrigger.next(".drawer2");
        if (drawer.is(":visible")) {
            drawer.slideUp(200);
        } else {
            drawer.slideDown(200);
            $(".drawer2").not(drawer).slideUp(200);
        }
    })
}

// ** Reorder Adresses **

function dragstart() {
    $(document).on("mousedown touchstart", ".currentpage .applist li .popoptions", function(e) {
        e.preventDefault();
        var this_drag = $(this),
            addresses = this_drag.closest(".applist").find("li");
        if (addresses.length < 2) {
            return
        }
        var thisli = this_drag.closest("li"),
            dialogheight = thisli.height(),
            startheight = e.originalEvent.touches ? e.originalEvent.touches[0].pageY : e.pageY;
        drag(thisli, dialogheight, startheight, thisli.index());
    })
}

function drag(thisli, dialogheight, startheight, thisindex) {
    $(document).on("mousemove touchmove", ".currentpage .applist li", function(e) {
        e.preventDefault();
        thisli.addClass("dragging");
        html.addClass("dragmode");
        var currentheight = e.originalEvent.touches ? e.originalEvent.touches[0].pageY : e.pageY,
            dragdistance = currentheight - startheight;
        thisli.addClass("dragging").css({
            "-webkit-transform": "translate(0, " + dragdistance + "px)"
        });
        $(".currentpage .applist li").not(thisli).each(function(i) {
            var this_li = $(this),
                thisoffset = this_li.offset().top,
                thisheight = this_li.height(),
                hoverpoint = thisoffset + (thisheight / 2),
                dragup = (i + 1 > thisindex) ? true : false;
            if (dragup === true) {
                if (currentheight > hoverpoint) {
                    this_li.css({
                        "-webkit-transform": "translate(0, -" + dialogheight + "px)"
                    }).addClass("hovered")
                    thisli.addClass("after").removeClass("before");
                } else {
                    this_li.css({
                        "-webkit-transform": "translate(0, 0)"
                    }).removeClass("hovered")
                }
            } else {
                if (currentheight < hoverpoint) {
                    this_li.css({
                        "-webkit-transform": "translate(0, " + dialogheight + "px)"
                    }).addClass("hovered")
                    thisli.addClass("before").removeClass("after");
                } else {
                    this_li.css({
                        "-webkit-transform": "translate(0, 0)"
                    }).removeClass("hovered")
                }
            }
        });
    })
}

function dragend() {
    $(document).on("mouseup mouseleave touchend", ".currentpage .applist li", function() {
        $(document).off("mousemove touchmove", ".currentpage .applist li");
        var thisunit = $(this).closest("li");
        if (thisunit.hasClass("dragging")) {
            if (thisunit.hasClass("before")) {
                thisunit.insertBefore(".hovered:first");
                saveaddresses(geturlparameters().p, false);
            } else if (thisunit.hasClass("after")) {
                thisunit.insertAfter(".hovered:last");
                saveaddresses(geturlparameters().p, false);
            }
            thisunit.removeClass("before after dragging").attr("style", "");
            $(".currentpage .applist li").removeClass("hovered").attr("style", "");
            html.removeClass("dragmode");
            clear_savedurl();
        }
    })
}

function keyup() {
    $(document).keyup(function(e) {
        if (e.keyCode == 39) {
            if (body.hasClass("showstartpage")) {
                e.preventDefault();
                startnext($(".panelactive"));
                return
            }
            if (paymentdialogbox.find("input").is(":focus")) {
                playsound(funk);
                return
            }
            var timelapsed = now() - sa_timer;
            if (timelapsed < 500) { // prevent clicking too fast
                playsound(funk);
                return
            }
            paymentpopup.removeClass("flipping");
            if (paymentdialogbox.hasClass("flipped")) {
                flip_right2();
                setTimeout(function() {
                    paymentpopup.addClass("flipping");
                    paymentdialogbox.css("-webkit-transform", "");
                }, 400);
                return
            }
            if (paymentdialogbox.hasClass("norequest") && (paymentdialogbox.attr("data-pending") == "ispending" || (offline === true))) {
                playsound(funk);
                return
            }
            flip_right1();
            sa_timer = now();
            return
        }
        if (e.keyCode == 37) {
            if (body.hasClass("showstartpage")) {
                e.preventDefault();
                startprev($(".panelactive"));
                return
            }
            if (paymentdialogbox.find("input").is(":focus")) {
                playsound(funk);
                return
            }
            var timelapsed = now() - sa_timer;
            if (timelapsed < 500) { // prevent clicking too fast
                playsound(funk);
                return
            }
            paymentpopup.removeClass("flipping");
            if (paymentdialogbox.hasClass("flipped")) {
                flip_left2();
                return
            }
            if (paymentdialogbox.hasClass("norequest") && (paymentdialogbox.attr("data-pending") == "ispending" || (offline === true))) {
                playsound(funk);
                return
            }
            flip_left1();
            setTimeout(function() {
                paymentpopup.addClass("flipping");
                paymentdialogbox.css("-webkit-transform", "rotateY(180deg)");
            }, 400);
            sa_timer = now();
            return
        }
        if (e.keyCode == 27) {
            escapeandback();
            return
        }
        if (e.keyCode == 13) {
            if ($("#popup").hasClass("active")) {
                $("#popup #execute").trigger("click");
            }
            return
        }
    });
}

function escapeandback() {
    if (body.hasClass("showcam")) {
        window.history.back();
        return
    }
    if ($("#loader").hasClass("active")) {
        closeloader();
        return
    }
    if ($("#notify").hasClass("popup")) {
        closenotify();
        return
    }
    if ($("#popup .selectbox .options").hasClass("showoptions")) {
        closeselectbox();
        return
    }
    if ($("#popup").hasClass("active")) {
        canceldialog();
        return
    }
    if ($("#sharepopup").hasClass("active")) {
        cancelsharedialog();
        return
    }
    if ($("#optionspop").hasClass("active")) {
        canceloptions();
        return
    }
    if (body.hasClass("seed_dialog")) {
        hide_seed_panel();
        return
    }
    if (body.hasClass("showstartpage")) {
        startprev($(".panelactive"));
    }
    if (paymentpopup.hasClass("active")) {
        if (paymentdialogbox.hasClass("flipped") && paymentdialogbox.hasClass("norequest")) {
            remove_flip();
        } else {
            if (request) {
                if (request.received === true) {
                    close_paymentdialog();
                } else {
                    cpd_pollcheck();
                }
            } else {
                close_paymentdialog();
            }
        }
        return
    } else {
        window.history.back();
    }
}

function close_paymentdialog(empty) {
    if (request) {
        if (empty === true && inframe === false && request.requesttype == "local") {
            var currency = request.payment,
                address = request.address,
                ls_recentrequests = localStorage.getItem("bitrequest_recent_requests"),
                lsrr_arr = (ls_recentrequests) ? JSON.parse(ls_recentrequests) : {},
                request_dat = {
                    "currency": currency,
                    "cmcid": request.cmcid,
                    "ccsymbol": request.currencysymbol,
                    "address": address,
                    "erc20": request.erc20,
                    "rqtime": request.rq_init
                };
            lsrr_arr[currency] = request_dat;
            localStorage.setItem("bitrequest_recent_requests", JSON.stringify(lsrr_arr));
            closeloader();
            toggle_rr(true);
            var rr_whitelist = sessionStorage.getItem("bitrequest_rrwl");
            if (rr_whitelist) {
                var rrwl_obj = JSON.parse(rr_whitelist);
                if (rrwl_obj && rrwl_obj[currency] == address) {
                    continue_cpd();
                    return
                }
            }
            payment_lookup(request_dat);
            return
        }
    }
    continue_cpd();
}

function continue_cpd() {
    if (html.hasClass("firstload")) {
        var gets = geturlparameters(),
			pagename = gets.p,
            set_pagename = (pagename) ? pagename : "home";
        openpage("?p=" + set_pagename, set_pagename, "loadpage");
    } else {
        window.history.back();
    }
}

function payment_lookup(request_dat) {
    if ($("#dismiss").length) {
        return false;
    }
    var currency = request.payment,
        blockexplorer = get_blockexplorer(currency),
        bu_url = blockexplorer_url(currency, false, request_dat.erc20) + request_dat.address,
        content = "<div class='formbox'>\
	        <h2 class='icon-warning'><span class='icon-qrcode'/>No payment detected</h2>\
	        <div id='ad_info_wrap'>\
	        	<p><strong><a href='" + bu_url + "' target='_blank' class='ref check_recent'>Look for recent incoming " + currency + " payments on " + blockexplorer + " <span class='icon-new-tab'></a></strong></p>\
		        <div class='pk_wrap noselect'>\
					<div id='dontshowwrap' class='cb_wrap' data-checked='false'><span class='checkbox'></span></div>\
					<span>Don't show again</span>\
				</div>\
			</div>\
	        <div id='backupactions'>\
				<div id='dismiss' class='customtrigger'>DISMISS</div>\
			</div>\
	        </div>";
    popdialog(content, "triggersubmit");
}

function check_recent() {
    $(document).on("click", ".check_recent", function(e) {
        e.preventDefault();
        var thisnode = $(this),
            thisurl = thisnode.attr("href"),
            result = confirm("Open " + thisurl + "?");
        if (result === true) {
            open_share_url("location", thisurl);
        }
        return
    })
}

function dismiss_payment_lookup() {
    $(document).on("click", "#dismiss", function() {
        var ds_checkbox = $("#dontshowwrap"),
            ds_checked = ds_checkbox.data("checked");
        if (ds_checked == true) {
            block_payment_lookup();
        }
        canceldialog();
        if (paymentpopup.hasClass("active")) {
            close_paymentdialog();
        }
    })
}

function block_payment_lookup() {
    if (request) {
        var rr_whitelist = sessionStorage.getItem("bitrequest_rrwl"),
            rrwl_arr = (rr_whitelist) ? JSON.parse(rr_whitelist) : {};
        rrwl_arr[request.payment] = request.address;
        sessionStorage.setItem("bitrequest_rrwl", JSON.stringify(rrwl_arr));
    }
}

function request_history() {
    $(document).on("click", "#request_history", function() {
        var ls_recentrequests = localStorage.getItem("bitrequest_recent_requests");
        if (ls_recentrequests) {
            var lsrr_arr = JSON.parse(ls_recentrequests);
            recent_requests(lsrr_arr);
        }
    })
}

function recent_requests(recent_payments) {
    var addresslist = recent_requests_list(recent_payments);
    if (!addresslist.length) {
        return
    }
    var content = "<div class='formbox'>\
        <h2 class='icon-history'>Recent requests:</h2>\
        <div id='ad_info_wrap'>\
        <ul>" + addresslist + "</ul>\
		</div>\
        <div id='backupactions'>\
			<div id='dismiss' class='customtrigger'>CANCEL</div>\
		</div>\
        </div>";
    popdialog(content, "triggersubmit");
}

function recent_requests_list(recent_payments) {
    var addresslist = "",
        rp_array = [];
    $.each(recent_payments, function(key, val) {
        if (val) {
            rp_array.push(val);
        }
    });
    var sorted_array = rp_array.sort(function(x, y) {
        return y.rqtime - x.rqtime;
    });
    $.each(sorted_array, function(i, val) {
        if (val) {
            var currency = val.currency,
                ccsymbol = val.ccsymbol,
                address = val.address,
                cmcid = val.cmcid,
                erc20 = val.erc20,
                rq_time = val.rqtime,
                blockchainurl = blockexplorer_url(currency, false, erc20) + address;
            addresslist += "<li class='rp_li'>" + getcc_icon(cmcid, ccsymbol + "-" + currency, erc20) + "<strong style='opacity:0.5'>" + short_date(rq_time + timezone) + "</strong><br/>\
			<a href='" + blockchainurl + "' target='_blank' class='ref check_recent'>\
			<span class='select'>" + address + "</span> <span class='icon-new-tab'></a></li>";
        }
    });
    return addresslist;
}

//notifications
function notify(message, time, showbutton) {
    var settime = (time) ? time : 4000,
        setbutton = (showbutton) ? showbutton : "no",
        notify = $("#notify");
    $("#notifysign").html(message + "<span class='icon-cross'></div>").attr("class", "button" + setbutton);
    notify.addClass("popupn");
    var timeout = setTimeout(function() {
        closenotify();
    }, settime, function() {
        clearTimeout(timeout);
    });
}

function closenotifytrigger() {
    $(document).on("click", "#notify .icon-cross", function() {
        closenotify()
    });
}

function closenotify() {
    $("#notify").removeClass("popupn");
}

function topnotify(message) {
    var topnotify = $("#topnotify");
    topnotify.text(message).addClass("slidedown");
    var timeout = setTimeout(function() {
        topnotify.removeClass("slidedown");
    }, 7000, function() {
        clearTimeout(timeout);
    });
}

function popnotify(result, message) {
    var notify = $(".popnotify");
    if (result == "error") {
        notify.removeClass("success warning").addClass("error");
    } else if (result == "warning") {
        notify.removeClass("success error").addClass("warning");
    } else {
        notify.addClass("success").removeClass("error warning");
    }
    notify.slideDown(200).html(message);
    var timeout = setTimeout(function() {
        notify.slideUp(200);
    }, 6000, function() {
        clearTimeout(timeout);
    });
}

//dialogs
function popdialog(content, functionname, trigger, custom, replace) {
    if (custom) {
        $("#popup #actions").addClass("custom");
    }
    if (replace) {
        $("#dialogbody").html(content);
    } else {
        $("#dialogbody").append(content);
    }
    body.addClass("blurmain");
    $("#popup").addClass("active showpu");
    var thistrigger = (trigger) ? trigger : $("#popup #execute");
    if (functionname) {
        execute(thistrigger, functionname);
    }
    if (supportsTouch === true) {} else {
        $("#dialogbody input:first").focus();
    }
}

function execute(trigger, functionname) {
    $(document).on("click", "#execute", function(e) {
        e.preventDefault();
        eval(functionname + "(trigger)");
        return
    })
}

function addcurrencytrigger() {
    $(document).on("click", ".addcurrency", function() {
        addcurrency($(this).closest("li").data());
    })
}

function addcurrency(cd) {
    var currency = cd.currency;
    if (get_addresslist(currency).children("li").length) {
        derive_first_check(currency);
        loadpage("?p=" + currency);
        return
    }
    var can_derive = derive_first_check(currency);
    if (can_derive === true) {
        loadpage("?p=" + currency);
        return
    }
    if (is_viewonly() === true) {
        vu_block();
        return
    }
    addaddress(cd, false);
}

function derive_first_check(currency) {
    if (hasbip32(currency) === true) {
        var derives = check_derivations(currency);
        if (derives) {
            var has_derives = active_derives(currency, derives);
            if (has_derives === false) {
                derive_addone(currency);
                return true;
            }
        }
    }
    return false;
}

function addaddresstrigger() {
    $(document).on("click", ".addaddress", function() {
        addaddress($("#" + $(this).attr("data-currency")).data(), false);
    })
}

function addaddress(ad, edit) {
    var currency = ad.currency,
        cpid = ad.ccsymbol + "-" + currency,
        address = (ad.address) ? ad.address : "",
        label = (ad.label) ? ad.label : "",
        derived = (ad.seedid || ad.xpubid),
        readonly = (edit === true) ? " readonly" : "",
        nopub = (test_derive === false) ? true : (is_xpub(currency) === false || has_xpub(currency) !== false),
        choose_wallet_str = "<span id='get_wallet' class='address_option' data-currency='" + currency + "'>I don't have a " + currency + " address yet</span>",
        derive_seed_str = "<span id='option_makeseed' class='address_option' data-currency='" + currency + "'>Generate address from secret phrase</span>",
        options = (hasbip === true) ? choose_wallet_str : (test_derive === true && c_derive[currency]) ? (hasbip32(currency) === true) ? derive_seed_str : choose_wallet_str : choose_wallet_str,
        pnotify = (body.hasClass("showstartpage")) ? "<div class='popnotify' style='display:block'>" + options + "</div>" : "<div class='popnotify'></div>",
        scanqr = (hascam === true && edit === false) ? "<div class='qrscanner' data-currency='" + currency + "' data-id='address' title='scan qr-code'><span class='icon-qrcode'></span></div>" : "",
        title = (edit === true) ? "<h2 class='icon-pencil'>Edit label</h2>" : "<h2>" + getcc_icon(ad.cmcid, cpid, ad.erc20) + " Add " + currency + " address</h2>",
        pk_checkbox = (edit === true) ? "" : "<div id='pk_confirm' class='noselect'><div id='pk_confirmwrap' class='cb_wrap' data-checked='false'><span class='checkbox'></span></div><span>I own the seed / private key of this address</span></div>",
        addeditclass = (edit === true) ? "edit" : "add",
        xpubclass = (nopub) ? " hasxpub" : " noxpub",
        xpubph = (nopub) ? "Enter a " + currency + " address" : "Address / Xpub",
        vk_val = (ad.vk) ? ad.vk : "",
        has_vk = (vk_val != ""),
        scanvk = (hascam === true) ? "<div class='qrscanner' data-currency='" + currency + "' data-id='viewkey' title='scan qr-code'><span class='icon-qrcode'></span></div>" : "",
        vk_box = (currency == "monero") ? (has_vk) ? "" : "<div class='inputwrap'><input type='text' class='vk_input' value='" + vk_val + "' placeholder='View key'>" + scanvk + "</div>" : "",
        content = $("<div class='formbox form" + addeditclass + xpubclass + "' id='addressformbox'>" + title + pnotify + "<form id='addressform' class='popform'><div class='inputwrap'><input type='text' id='address_xpub_input' class='address' value='" + address + "' data-currency='" + currency + "' placeholder='" + xpubph + "'" + readonly + ">" + scanqr + "</div>" + vk_box + "<input type='text' class='addresslabel' value='" + label + "' placeholder='label'>\
        <div id='ad_info_wrap' style='display:none'>\
			<ul class='td_box'>\
			</ul>\
			<div id='pk_confirm' class='noselect'>\
				<div id='matchwrap' class='cb_wrap' data-checked='false'><span class='checkbox'></span></div><span>The above addresses match those in my " + currency + " wallet</span>\
			</div>\
		</div>" + pk_checkbox +
            "<input type='submit' class='submit' value='OK'></form>").data(ad);
    popdialog(content, "triggersubmit");
    if (supportsTouch === true) {
        return
    }
    if (edit === true) {
        $("#popup input.addresslabel").focus().select();
        return
    }
    $("#popup input.address").focus();
}

function address_xpub_change() {
    $(document).on("input", "#addressformbox.noxpub #address_xpub_input", function(e) {
        var thisnode = $(this),
            addressinputval = thisnode.val();
        if (addressinputval.length > 103) {
            var currency = thisnode.attr("data-currency"),
                valid = check_xpub(addressinputval, xpub_prefix(currency), currency);
            if (valid === true) {
                clear_xpub_checkboxes();
                validate_xpub(thisnode.closest("#addressformbox"));
                return
            }
            xpub_fail(currency);
            return
        }
        clear_xpub_inputs();
    })
}

function active_derives(currency, derive) {
    var addresslist = get_addresslist(currency).children("li");
    if (addresslist.length < 1) {
        return false;
    }
    var coinsettings = activecoinsettings(currency);
    if (coinsettings) {
        var reuse = coinsettings["Reuse address"];
        if (reuse) {
            if (reuse.selected === true) {
                return true;
            }
        } else {
            return true;
        }
    }
    if (derive == "seed") {
        var active_sder = filter_list(addresslist, "seedid", bipid).not(".used");
        if (active_sder.length) {
            var check_p = ch_pending(active_sder.first().data());
            if (check_p === true) {
                return false;
            }
        } else {
            return false;
        }
    }
    if (derive == "xpub") {
        var activepub = active_xpub(currency),
            xpubid = activepub.key_id,
            active_xder = filter_list(addresslist, "xpubid", xpubid).not(".used");
        if (active_xder.length) {
            var check_p = ch_pending(active_xder.first().data());
            if (check_p === true) {
                return false;
            }
        } else {
            return false;
        }
    }
    return true
}

function get_wallet() {
    $(document).on("click", "#get_wallet", function() {
        var this_currency = $(this).attr("data-currency");
        canceldialog();
        setTimeout(function() {
            download_wallet(this_currency);
        }, 800);
    })
}

function submitaddresstrigger() {
    $(document).on("click", "#addressformbox input.submit", function(e) {
        e.preventDefault();
        var thisform = $(this).closest("#addressformbox");
        if (thisform.hasClass("hasxpub")) {
            validateaddress_vk(thisform.data());
            return
        }
        var addressinput = thisform.find(".address"),
            ad_val = addressinput.val();
        if (ad_val.length > 103) {
            validate_xpub(thisform);
            return
        }
        validateaddress_vk(thisform.data());
        return
    })
}

//Add erc20 token
function add_erc20() {
    $(document).on("click", "#add_erc20, #choose_erc20", function() {
        var tokenobject = JSON.parse(localStorage.getItem("bitrequest_erc20tokens")),
            tokenlist = "";
        $.each(tokenobject, function(key, value) {
            tokenlist += "<span data-id='" + value.cmcid + "' data-currency='" + value.name + "' data-ccsymbol='" + value.symbol.toLowerCase() + "' data-contract='" + value.contract + "' data-pe='none'>" + value.symbol + " | " + value.name + "</span>";
        });
        var nodedata = {
                "erc20": true,
                "monitored": true,
                "checked": true
            },
            scanqr = (hascam === true) ? "<div class='qrscanner' data-currency='ethereum' data-id='address' title='scan qr-code'><span class='icon-qrcode'></span></div>" : "",
            content = $("\
			<div class='formbox' id='erc20formbox'>\
				<h2 class='icon-coin-dollar'>Add erc20 token</h2>\
				<div class='popnotify'></div>\
				<form id='addressform' class='popform'>\
					<div class='selectbox'>\
						<input type='text' value='' placeholder='Pick erc20 token' id='ac_input'/>\
						<div class='selectarrows icon-menu2' data-pe='none'></div>\
						<div id='ac_options' class='options'>" + tokenlist + "</div>\
					</div>\
					<div id='erc20_inputs'>\
					<div class='inputwrap'><input type='text' class='address' value='' placeholder='Enter a address'/>" + scanqr + "</div>\
					<input type='text' class='addresslabel' value='' placeholder='label'/>\
					<div id='pk_confirm' class='noselect'>\
						<div id='pk_confirmwrap' class='cb_wrap' data-checked='false'>\
							<span class='checkbox'></span>\
						</div>\
						<span>I own the seed / private key of this address</span>\
					</div></div>\
					<input type='submit' class='submit' value='OK'/>\
				</form></div>").data(nodedata);
        popdialog(content, "triggersubmit");
    })
}

function autocomplete_erc20token() {
    $(document).on("input", "#ac_input", function() {
        var thisinput = $(this),
            thisform = thisinput.closest("form");
        thisform.removeClass("validated");
        var thisvalue = thisinput.val().toLowerCase(),
            options = thisform.find(".options");
        $("#ac_options > span").each(function(i) {
            var thisoption = $(this);
            thisoption.removeClass("show");
            var thistext = thisoption.text(),
                currency = thisoption.attr("data-currency"),
                currencysymbol = thisoption.attr("data-ccsymbol"),
                contract = thisoption.attr("data-contract"),
                thisid = thisoption.attr("data-id");
            if (thisvalue.length > 2 && currencysymbol === thisvalue || currency === thisvalue) {
                thisform.addClass("validated");
                var coin_data = {
                    "cmcid": thisid,
                    "currency": currency,
                    "ccsymbol": currencysymbol,
                    "contract": contract
                }
                thisinput.val(thistext)[0].setSelectionRange(0, 999);
                initaddressform(coin_data);
            } else if (currencysymbol.match("^" + thisvalue) || currency.match("^" + thisvalue)) {
                thisoption.addClass("show");
            }
        });
    })
}

function pickerc20select() {
    $(document).on("click", "#erc20formbox .selectbox > #ac_options span", function() {
        var thisselect = $(this),
            coin_data = {
                "cmcid": thisselect.attr("data-id"),
                "currency": thisselect.attr("data-currency"),
                "ccsymbol": thisselect.attr("data-ccsymbol"),
                "contract": thisselect.attr("data-contract")
            };
        initaddressform(coin_data);
    })
}

function initaddressform(coin_data) {
    var erc20formbox = $("#erc20formbox"),
        erc20_inputs = erc20formbox.find("#erc20_inputs"),
        addressfield = erc20formbox.find("input.address"),
        labelfield = erc20formbox.find("input.addresslabel");
    addressfield.add(labelfield).val("");
    erc20formbox.data(coin_data);
    addressfield.attr("placeholder", "Enter a " + coin_data.currency + " address");
    if (erc20_inputs.is(":visible")) {} else {
        erc20_inputs.slideDown(300);
        addressfield.focus();
    }
}

function submit_erc20() {
    $(document).on("click", "#erc20formbox input.submit", function(e) {
        e.preventDefault();
        validateaddress_vk($("#erc20formbox").data());
    });
}

function validateaddress_vk(ad) {
    var currency = ad.currency,
        addressfield = $("#addressform .address"),
        addressinputval = addressfield.val();
    if (addressinputval) {} else {
        var errormessage = "Enter a " + currency + " address";
        popnotify("error", errormessage);
        addressfield.focus();
        return
    }
    if (currency) {
        var vkfield = $("#addressform .vk_input"),
            vkinputval = (currency == "monero") ? (vkfield.length) ? vkfield.val() : 0 : 0,
            vklength = vkinputval.length;
        if (vklength) {
            if (vklength !== 64) {
                popnotify("error", "Invalid Viewkey");
                return
            }
            if (check_vk(vkinputval)) {} else {
                popnotify("error", "Invalid Viewkey");
                return
            }
            var valid = check_address(addressinputval, currency);
            if (valid === true) {} else {
                var errormessage = addressinputval + " is NOT a valid " + currency + " address";
                popnotify("error", errormessage);
                return
            }
            var payload = {
                "address": addressinputval,
                "view_key": vkinputval,
                "create_account": true,
                "generated_locally": false
            };
            api_proxy({
                "api": "mymonero api",
                "search": "login",
                "cachetime": 25,
                "cachefolder": "1h",
                "params": {
                    "method": "POST",
                    "data": JSON.stringify(payload),
                    "headers": {
                        "Content-Type": "application/json"
                    }
                }
            }).done(function(e) {
                var data = br_result(e).result,
                    errormessage = data.Error;
                if (errormessage) {
                    var error = (errormessage) ? errormessage : "Invalid Viewkey";
                    popnotify("error", error);
                    return
                }
                var start_height = data.start_height;
                if (start_height > -1) { // success!
                    validateaddress(ad, vkinputval);
                }
            }).fail(function(jqXHR, textStatus, errorThrown) {
                console.log(jqXHR);
                console.log(textStatus);
                console.log(errorThrown);
                popnotify("error", "Error verifying Viewkey");
            });
            return
        }
        validateaddress(ad, false);
        return
    }
    popnotify("error", "Pick a currency");
}

function validateaddress(ad, vk) {
    var currency = ad.currency,
        iserc20 = (ad.erc20 === true),
        currencycheck = (iserc20 === true) ? "ethereum" : currency,
        ccsymbol = ad.ccsymbol,
        addressfield = $("#addressform .address"),
        addressinputvalue = addressfield.val(),
        addressinputval = (currency == "nimiq") ? addressinputvalue.replace(/\s/g, "") : addressinputvalue,
        currentaddresslist = get_addresslist(currency),
        getindex = currentaddresslist.children("li").length + 1,
        index = (getindex > 1) ? getindex : 1,
        labelfield = $("#addressform .addresslabel"),
        labelinput = labelfield.val(),
        labelinputval = (labelinput) ? labelinput : "";
    if (addressinputval) {
        var addinputval = (addressinputval.indexOf(":") > -1) ? addressinputval.split(":").pop() : addressinputval,
            addressduplicate = currentaddresslist.children("li[data-address=" + addinputval + "]").length > 0,
            address = ad.address,
            label = ad.label;
        if (addressduplicate === true && address !== addinputval) {
            popnotify("error", "address already exists");
            addressfield.select();
            return
        }
        var valid = check_address(addinputval, currencycheck);
        if (valid === true) {
            var validlabel = check_address(labelinputval, currencycheck);
            if (validlabel === true) {
                popnotify("error", "invalid label");
                labelfield.val(label).select();
                return
            }
            if ($("#addressformbox").hasClass("formedit")) {
                var currentlistitem = currentaddresslist.children("li[data-address='" + address + "']"),
                    ed = {};
                ed.label = labelinputval;
                if (vk) {
                    ed.vk = vk;
                }
                currentlistitem.data(ed).attr("data-address", addinputval);
                currentlistitem.find(".atext h2 > span").text(labelinputval);
                currentlistitem.find(".atext p.address").text(addinputval);
                saveaddresses(currency, true);
                canceldialog();
                canceloptions();
                return
            }
            var pk_checkbox = $("#pk_confirmwrap"),
                pk_checked = pk_checkbox.data("checked");
            if (pk_checked == true) {
                if (index === 1) {
                    if (iserc20 === true) {
                        buildpage(ad, true);
                        append_coinsetting(currency, br_config.erc20_dat.settings, false);
                    }
                    if (body.hasClass("showstartpage")) {
                        var acountname = $("#eninput").val();
                        $("#accountsettings").data("selected", acountname).find("p").text(acountname);
                        savesettings();
                        var href = "?p=home&payment=" + currency + "&uoa=" + ccsymbol + "&amount=0" + "&address=" + addinputval;
                        localStorage.setItem("bitrequest_editurl", href); // to check if request is being edited
                        openpage(href, "create " + currency + " request", "payment");
                        body.removeClass("showstartpage");
                    } else {
                        loadpage("?p=" + currency);
                    }
                }
                ad.address = addinputval,
                    ad.label = labelinputval,
                    ad.a_id = ccsymbol + index,
                    ad.vk = vk,
                    ad.checked = true;
                appendaddress(currency, ad);
                saveaddresses(currency, true);
                currency_check(currency);
                canceldialog();
                canceloptions();
                clear_savedurl();
                return
            }
            popnotify("error", "Confirm privatekey ownership");
            return
        }
        popnotify("error", addressinputval + " is NOT a valid " + currency + " address");
        setTimeout(function() {
            addressfield.select();
        }, 10);
        return
    }
    popnotify("error", "Enter a " + currency + " address");
    addressfield.focus();
}

function check_address(address, currency) {
    var regex = getcoindata(currency).regex;
    return (regex) ? new RegExp(regex).test(address) : false;
}

function check_vk(vk) {
    return new RegExp("^[a-fA-F0-9]+$").test(vk);
}

function send_trigger() {
    $(document).on("click", ".send", function() {
        if (hasbip === true) {
            compatible_wallets($(this).attr("data-currency"));
            return
        }
        playsound(funk);
    })
}

function showbip39_trigger() {
    $(document).on("click", ".show_bip39", function() {
        all_pinpanel({
            "func": manage_bip32
        });
        canceldialog();
    })
}

function canceldialog_click() {
    $(document).on("click", ".cancel_dialog", function() {
        canceldialog();
    })
}

function canceldialogtrigger() {
    $(document).on("click", "#popup", function(e) {
        var target = e.target,
            jtarget = $(target),
            target_id = jtarget.attr("id"),
            options = $("#dialog").find(".options");
        if (options.length > 0 && options.hasClass("showoptions")) {
            var pointerevent = jtarget.attr("data-pe");
            if (pointerevent == "none") {} else {
                options.removeClass("showoptions");
            }
            return
        }
        if (target == this || target_id == "canceldialog") {
            canceldialog();
        }
    });
}

function canceldialog(pass) {
    if (inframe === true) {
        if (pass === true) {} else {
            if ($("#contactformbox").length > 0) {
                return false;
            }
        }
    }
    var popup = $("#popup");
    body.removeClass("blurmain themepu");
    popup.removeClass("active");
    var timeout = setTimeout(function() {
        popup.removeClass("showpu");
        $("#dialogbody").html("");
        $("#actions").removeClass("custom");
        $(document).off("click", "#execute");
        // reset Globals
        s_id = null;
    }, 600, function() {
        clearTimeout(timeout);
    });
    if (request) { // reset after_poll
        request.rq_timer = now();
    }
}

function blockcancelpaymentdialog() {
    $(document).on("mousedown", "#payment", function(e) {
        blockswipe = false;
        if (e.target == this) {
            var inputs = paymentdialogbox.find("input");
            if (inputs.is(":focus")) {
                blockswipe = true;
            }
        }
    })
}

function cancelpaymentdialogtrigger() {
    $(document).on("mouseup", "#payment", function(e) {
        if (blockswipe === true) {
            unfocus_inputs();
            return
        }
        if (html.hasClass("flipmode")) { // prevent closing request when flipping
            return
        }
        var timelapsed = now() - cp_timer;
        if (timelapsed < 1500) { // prevent clicking too fast
            playsound(funk);
            console.log("clicking too fast");
            return
        }
        if (e.target == this) {
            escapeandback();
            cp_timer = now();
        }
    });
}

function unfocus_inputs() {
    var inputs = paymentdialogbox.find("input");
    inputs.blur();
}

function cpd_pollcheck() {
    if (paymentdialogbox.attr("data-lswitch") == "lnd_ao") {
        close_paymentdialog();
        return
    }
    if (request) {
        if (request.received !== true) {
            var rq_init = request.rq_init,
                rq_timer = request.rq_timer,
                rq_time = now() - rq_timer;
            if (rq_time > after_poll_timeout) {
                after_poll(rq_init);
                return
            }
        }
    }
    close_paymentdialog();
}

function cancelpaymentdialog() {
    if (html.hasClass("hide_app")) {
        closeloader();
        parent.postMessage("close_request", "*");
        return
    }
    paymentpopup.removeClass("active");
    html.removeClass("blurmain_payment");
    var timeout = setTimeout(function() {
        paymentpopup.removeClass("showpu outgoing");
        html.removeClass("paymode firstload");
        $(".showmain #mainwrap").css("-webkit-transform", "translate(0, 0)"); // restore fake scroll position
        $(".showmain").closest(document).scrollTop(scrollposition); // restore real scroll position
        remove_flip(); // reset request facing front
        paymentdialogbox.html(""); // remove html
        clearTimeout(timeout);
    }, 600);
    closeloader();
    clearTimeout(request_timer);
    closesocket();
    clearpinging();
    closenotify();
    sleep();
    abort_ndef();
    lnd_ph = false;
    if (gd_init === true) {
        gd_init = false;
        var pass = GD_pass();
        if (pass) {
            return
        }
        oauth_pop();
    }
}

function closesocket(s_id) {
    if (s_id) { // close this socket
        if (sockets[s_id]) {
            sockets[s_id].close();
            delete sockets[s_id];
        }
    } else { // close all sockets
        $.each(sockets, function(key, value) {
            value.close();
        });
        sockets = {};
    }
    txid = null;
}

function forceclosesocket() {
    clearpinging();
    closesocket();
}

function clearpinging(s_id) {
    if (s_id) { // close this interval
        if (pinging[s_id]) {
            clearInterval(pinging[s_id]);
            delete pinging[s_id]
        }
    } else { // close all intervals
        if ($.isEmptyObject(pinging)) {} else {
            $.each(pinging, function(key, value) {
                clearInterval(value);
            });
            pinging = {};
        }
    }
}

function cancelsharedialogtrigger() {
    $(document).on("click", "#sharepopup", function(e) {
        if (e.target == this) {
            cancelsharedialog();
        }
    });
}

function cancelsharedialog() {
    var sharepopup = $("#sharepopup");
    sharepopup.removeClass("active");
    body.removeClass("sharemode");
    var timeout = setTimeout(function() {
        sharepopup.removeClass("showpu");
    }, 500, function() {
        clearTimeout(timeout);
    });
}

function showoptionstrigger() {
    $(document).on("click", ".popoptions", function(e) {
        var ad = $(this).closest("li").data(),
            savedrequest = $("#requestlist li[data-address='" + ad.address + "']"),
            showrequests = (savedrequest.length > 0) ? "<li><div class='showrequests'><span class='icon-qrcode'></span> Show requests</div></li>" : "",
            newrequest = (ad.checked === true) ? "<li>\
				<div data-rel='' class='newrequest' title='create request'>\
					<span class='icon-plus'></span> New request</div>\
			</li>" : "",
            content = $("\
				<ul id='optionslist''>" + newrequest + showrequests +
                "<li><div class='address_info'><span class='icon-info'></span> Address info</div></li>\
                	<li><div class='editaddress'> <span class='icon-pencil'></span> Edit label</div></li>\
					<li><div class='removeaddress'><span class='icon-bin'></span> Remove address</div></li>\
					<li><div id='rpayments'><span class='icon-history'></span> Recent payments</div></li>\
				</ul>").data(ad);
        showoptions(content);
        return false;
    });
}

function showoptions(content, addclass, callback) {
    if (addclass) {
        if (addclass.indexOf("pin") > -1) {
            var pinsettings = $("#pinsettings").data(),
                timeout = pinsettings.timeout;
            if (timeout) {
                if (now() > timeout) {
                    pinsettings.timeout = null;
                    savesettings();
                } else {
                    lockscreen(timeout);
                    return false;
                }
            }
        }
    }
    var plusclass = (addclass) ? " " + addclass : "";
    $("#optionspop").addClass("showpu active" + plusclass);
    $("#optionsbox").html(content);
    body.addClass("blurmain_options");
}

function lockscreen(timer) {
    var timeleft = timer - now(),
        cd = countdown(timeleft),
        dstr = (cd.days) ? cd.days + " days<br/>" : "",
        hstr = (cd.hours) ? cd.hours + " hours<br/>" : "",
        mstr = (cd.minutes) ? cd.minutes + " minutes<br/>" : "",
        sstr = (cd.seconds) ? cd.seconds + " seconds" : "",
        cdown_str = dstr + hstr + mstr + sstr,
        attempts = $("#pinsettings").data("attempts"),
        has_seedid = (hasbip || cashier_seedid) ? true : false,
        us_string = (has_seedid === true && attempts > 5) ? "<p id='seed_unlock'>Unlock with seed</p>" : "",
        content = "<h1 id='lock_heading'>Bitrequest</h1><div id='lockscreen'><h2><span class='icon-lock'></span></h2><p class='tmua'>Too many unlock attempts</p>\
    	<p><br/>Please try again in:<br/>" + cdown_str + "</p>" + us_string +
        "<div id='phrasewrap'>\
	    	<p><br/>Enter your 12 word<br/>secret phrase:</p>\
	    		<div id='bip39phrase' contenteditable='contenteditable' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' lang='en' class='noselect'></div>\
	    		<div id='phrase_login' class='button'>Unlock</div>\
			</div>\
		</div>";
    $("#optionspop").addClass("showpu active pin ontop");
    $("#optionsbox").html(content);
    body.addClass("blurmain_options");
}

function seed_unlock_trigger() {
    $(document).on("click", "#lockscreen #seed_unlock", function() {
        $("#lockscreen #phrasewrap").addClass("showph");
    });
}

function phrase_login() {
    $(document).on("click", "#phrase_login", function() {
        var bip39phrase = $("#lockscreen #bip39phrase"),
            b39txt = bip39phrase.text(),
            seedobject = ls_phrase_obj(),
            savedid = seedobject.pid,
            phraseid = get_seedid(b39txt.split(" "));
        if (phraseid == savedid || phraseid == cashier_seedid) {
            clearpinlock();
            if (html.hasClass("loaded")) {} else {
                finishfunctions();
            }
            var content = pinpanel(" reset");
            showoptions(content, "pin");
            $("#pinfloat").removeClass("p_admin");
            remove_cashier();
        } else {
            shake(bip39phrase);
        }
    });
}

function remove_cashier() {
    if (is_cashier) {
        localStorage.removeItem("bitrequest_cashier");
        cashier_dat = false,
            is_cashier = false,
            cashier_seedid = false;
    }
}

function newrequest_alias() {
    $(document).on("click", "#newrequest_alias", function() {
        var currencylist = $("#currencylist"),
            active_currencies = currencylist.find("li").not(".hide"),
            active_currency_count = active_currencies.length;
        if (active_currency_count === 0) {
            notify("no active currencies");
            return
        }
        if (active_currency_count > 1) {
            content = "<ul id='alias_currencylist' class='currencylist'>" + currencylist.html() + "</ul>"
            showoptions(content);
            return
        }
        var active_currency_trigger = active_currencies.find(".rq_icon").first();
        triggertxfunction(active_currency_trigger);
    });
}

function newrequest() {
    $(document).on("click", ".newrequest", function() {
        var thislink = $(this),
            ad = thislink.closest("#optionslist").data(),
            currency = ad.currency,
            address = ad.address,
            ccsymbol = ad.ccsymbol,
            title = thislink.attr("title"),
            seedid = ad.seedid;
        if (seedid) {
            if (seedid != bipid) {
                if (addr_whitelist(address) === true) {} else {
                    var pass_dat = {
                            "currency": currency,
                            "address": address,
                            "ccsymbol": ccsymbol,
                            "title": title,
                            "seedid": seedid
                        },
                        content = get_address_warning("address_newrequest", address, pass_dat);
                    popdialog(content, "triggersubmit");
                    return
                }
            } else {
                if (bipv_pass() === false) {
                    canceloptions();
                    return
                }
            }
        }
        newrequest_cb(currency, ccsymbol, address, title);
    });
}

function confirm_ms_newrequest() {
    $(document).on("click", "#address_newrequest .submit", function(e) {
        e.preventDefault();
        var thisdialog = $("#address_newrequest"),
            d_dat = thisdialog.data(),
            pk_checkbox = thisdialog.find("#pk_confirmwrap"),
            pk_checked = pk_checkbox.data("checked"),
            ds_checkbox = thisdialog.find("#dontshowwrap"),
            ds_checked = ds_checkbox.data("checked");
        if (pk_checked == true) {} else {
            popnotify("error", "Confirm privatekey ownership");
            return
        }
        if (ds_checked == true) { // whitlist seed id
            add_address_whitelist(d_dat.address);
        }
        canceloptions();
        canceldialog();
        newrequest_cb(d_dat.currency, d_dat.ccsymbol, d_dat.address, d_dat.title);
        return
    })
}

function newrequest_cb(currency, ccsymbol, address, title) {
    var gets = geturlparameters();
    if (gets == "xss") {
        return
    }
    var thishref = "?p=" + gets.p + "&payment=" + currency + "&uoa=" + ccsymbol + "&amount=0&address=" + address;
    localStorage.setItem("bitrequest_editurl", thishref); // to check if request is being edited
    canceloptions();
    remove_flip(); // reset request card facing front
    openpage(thishref, title, "payment");
}

function showrequests() {
    $(document).on("click", ".showrequests", function(e) {
        e.preventDefault();
        loadpage("?p=requests&filteraddress=" + $(this).closest("ul").data("address"));
        canceloptions();
    });
}

function showrequests_inlne() {
    $(document).on("click", ".applist.pobox li .usedicon", function() {
        var address = $(this).prev("span").text(),
            result = confirm("Show requests for " + address + "?");
        if (result === true) {
            loadpage("?p=requests&filteraddress=" + address);
        }
    });
}

function editaddresstrigger() {
    $(document).on("click", ".editaddress", function(e) {
        e.preventDefault();
        addaddress($(this).closest("ul").data(), true);
    })
}

function removeaddress() {
    $(document).on("click", ".removeaddress", function(e) {
        e.preventDefault();
        popdialog("<h2 class='icon-bin'>Remove address?</h2>", "removeaddressfunction", $(this));
    })
}

function removeaddressfunction(trigger) {
    var result = confirm("Are you sure?");
    if (result === true) {
        var optionslist = trigger.closest("ul#optionslist"),
            ad = optionslist.data(),
            currency = ad.currency,
            address = ad.address,
            erc20 = ad.erc20,
            currentaddresslist = get_addresslist(currency);
        currentaddresslist.children("li[data-address='" + address + "']").remove();
        if (currentaddresslist.children("li").length) {} else {
            loadpage("?p=currencies");
            var currencyli = $("#usedcurrencies > li[data-currency='" + currency + "']"),
                homeli = $("#currencylist > li[data-currency='" + currency + "']");
            if (erc20 === true) {
                $("#" + currency + ".page").remove();
                currencyli.remove();
                homeli.remove();
            } else {
                currencyli.data("checked", false).attr("data-checked", "false");
                homeli.addClass("hide");
            }
            savecurrencies(true);
        }
        canceldialog();
        canceloptions();
        notify("Address deleted 🗑");
        saveaddresses(currency, true);
    }
}

function rec_payments() {
    $(document).on("click", "#rpayments", function() {
        var ad = $(this).closest("ul").data(),
            blockchainurl = blockexplorer_url(ad.currency, false, ad.erc20);
        if (blockchainurl === undefined) {} else {
            open_blockexplorer_url(blockchainurl + ad.address);
        }
    })
}

function showtransaction_trigger() {
    $(document).on("click", ".metalist .show_tx, .transactionlist .tx_val", function() {
        var thisnode = $(this),
            thislist = thisnode.closest("li"),
            rqli = thisnode.closest("li.rqli"),
            rqldat = rqli.data(),
            txhash = (thisnode.hasClass("tx_val")) ? thislist.data("txhash") : rqldat.txhash,
            lnhash = (txhash && txhash.slice(0, 9) == "lightning") ? true : false;
        if (lnhash) {
            var lightning = rqldat.lightning,
                imp = lightning.imp,
                invoice = lightning.invoice;
            if (invoice) {
                var hash = invoice.hash;
                if (hash) {
                    var result = confirm("Open invoice: " + hash + "?");
                    if (result === true) {
                        var proxy = lightning.proxy_host,
                            nid = lightning.nid,
                            pid = lightning.pid,
                            pw = lightning.pw;
                        lnd_lookup_invoice(proxy, imp, hash, nid, pid, pw);
                        return;
                    }
                }
            }
            playsound(funk);
            return
        }
        var currency = rqli.data("payment"),
            erc20 = rqli.data("erc20"),
            blockchainurl = blockexplorer_url(currency, true, erc20);
        if (blockchainurl === undefined || txhash === undefined) {} else {
            open_blockexplorer_url(blockchainurl + txhash);
        }
    })
}

function showtransactions() {
    $(document).on("click", ".showtransactions", function(e) {
        e.preventDefault();
        var ad = $("#ad_info_wrap").data(),
            blockchainurl = blockexplorer_url(ad.currency, false, ad.erc20);
        if (blockchainurl === undefined) {} else {
            open_blockexplorer_url(blockchainurl + ad.address);
        }
    })
}

function addressinfo() {
    $(document).on("click", ".address_info", function() {
        var dialogwrap = $(this).closest("ul"),
            dd = dialogwrap.data(),
            label = (dd.label) ? dd.label : (dd.a_id) ? dd.a_id : "",
            currency = dd.currency,
            isbip = hasbip32(currency),
            bip32dat = (isbip) ? getbip32dat(currency) : null,
            seedid = dd.seedid,
            xpubid = dd.xpubid,
            vk = dd.vk,
            source = (seedid) ? "seed" : (xpubid) ? "xpub" : false,
            isseed = (source == "seed"),
            isxpub = (source == "xpub"),
            activepub = active_xpub(currency),
            active_src = (isseed) ? (seedid == bipid) :
            (isxpub) ? (activepub && xpubid == activepub.key_id) : false,
            address = dd.address,
            a_wl = addr_whitelist(address),
            restore = (isseed) ? (hasbip === true) ? "" : "<div id='rest_seed' class='ref' data-seedid='" + seedid + "'>Restore</div>" : "",
            srcval = (source) ? (active_src) ? source + " <span class='icon-checkmark'>" :
            source + " (Unavailable)" + restore : "external",
            d_index = dd.derive_index,
            dpath = (bip32dat) ? bip32dat.root_path + d_index : "",
            purpose = dd.purpose;
        if (purpose) {
            var dsplit = dpath.split("/");
            dsplit[1] = purpose;
            var dpath = dsplit.join("/");
        }
        dd.dpath = dpath,
            dd.bip32dat = bip32dat;
        var cc_icon = getcc_icon(dd.cmcid, dd.ccsymbol + "-" + currency, dd.erc20),
            dpath_str = (isseed) ? "<li><strong>Derivation path:</strong> " + dpath + "</li>" : "",
            pk_verified = "Unknown <span class='icon-checkmark'></span>",
            vkobj = (dd.vk) ? vk_obj(dd.vk) : false,
            vkdat = (vkobj) ? (isseed && active_src) ? "derive" : vkobj.vk : false,
            pk_str = (vkdat) ? "<span id='show_vk' class='ref' data-vk='" + vkdat + "'>Show</span>" : (isseed) ? (active_src) ? "<span id='show_pk' class='ref'>Show</span>" : (a_wl === true) ? pk_verified : "Unknown" : pk_verified,
            content = $("<div id='ad_info_wrap'><h2>" + cc_icon + " <span>" + label + "</span></h2><ul>\
	    		<li><strong>Address: </strong><span class='adbox adboxl select'>" + address + "</span></li>\
	    		<li><strong>Source: </strong>" + srcval + "</li>" +
                dpath_str +
                "<li><strong>Private key: </strong>" + pk_str +
                "<div id='pk_span'>\
					<div class='qrwrap flex'>\
						<div id='qrcode' class='qrcode'></div>" + cc_icon + "</div>\
						<p id='pkspan' class='adbox adboxl select' data-type='private key'></p>\
				</div>\
				</li>\
				<li><div class='showtransactions ref'><span class='icon-eye'></span> Show transactions</div></li>\
				</ul>\
	    	</div>").data(dd);
        popdialog(content, "canceldialog");
        return false;
    })
}

function show_pk() {
    $(document).on("click", "#show_pk", function() {
        if (is_viewonly() === true) {
            vu_block();
            return
        }
        var thisbttn = $(this),
            pkspan = $("#pk_span");
        if (pkspan.is(":visible")) {
            pkspan.slideUp(200);
            thisbttn.text("show");
            return
        }
        if (pkspan.hasClass("shwpk")) {
            pkspan.slideDown(200);
            thisbttn.text("hide");
            return
        }
        $("#optionsbox").html("");
        var addat = $("#ad_info_wrap").data(),
            currency = addat.currency,
            keycc = key_cc(),
            dx_dat = {
                "dpath": addat.dpath,
                "key": keycc.key,
                "cc": keycc.cc
            },
            x_keys_dat = derive_x(dx_dat),
            key_object = format_keys(keycc.seed, x_keys_dat, addat.bip32dat, addat.derive_index, currency),
            privkey = key_object.privkey;
        all_pinpanel({
            "func": show_pk_cb,
            "args": privkey
        }, true)
    })
}

function show_pk_cb(pk) {
    $("#show_pk").text("hide");
    $("#pkspan").text(pk);
    $("#qrcode").qrcode(pk);
    $("#pk_span").addClass("shwpk").slideDown(200);
}

function show_vk() {
    $(document).on("click", "#show_vk", function() {
        if (is_viewonly() === true) {
            vu_block();
            return
        }
        var thisbttn = $(this),
            vk = thisbttn.attr("data-vk"),
            pkspan = $("#pk_span");
        if (pkspan.is(":visible")) {
            pkspan.slideUp(200);
            thisbttn.text("show");
            return
        }
        if (pkspan.hasClass("shwpk")) {
            pkspan.slideDown(200);
            thisbttn.text("hide");
            return
        }
        $("#optionsbox").html("");
        var x_ko = {};
        if (vk == "derive") {
            var addat = $("#ad_info_wrap").data(),
                keycc = key_cc(),
                dx_dat = {
                    "dpath": addat.dpath,
                    "key": keycc.key,
                    "cc": keycc.cc
                },
                x_keys_dat = derive_x(dx_dat),
                rootkey = x_keys_dat.key,
                ssk = sc_reduce32(fasthash(rootkey)),
                x_ko = xmr_getpubs(ssk, addat.derive_index);
        } else {
            x_ko = {
                "stat": true,
                "svk": vk
            }
        }
        all_pinpanel({
            "func": show_vk_cb,
            "args": x_ko
        }, true)
    })
}

function show_vk_cb(kd) {
    var stat = kd.stat,
        ststr = (stat) ? "" : "<br/><strong style='color:#8d8d8d'>Spendkey</strong> <span class='adbox adboxl select' data-type='Spendkey'>" + kd.ssk + "</span><br/>";
    $("#show_vk").text("hide");
    $("#pk_span").html(ststr + "<br/><strong style='color:#8d8d8d'>Viewkey</strong> <span class='adbox adboxl select' data-type='Viewkey'>" + kd.svk + "</span>").addClass("shwpk").slideDown(200);
}

function open_blockexplorer_url(be_link) {
    var result = confirm("Open " + be_link + "?");
    if (result === true) {
        w_loc.href = be_link;
    }
}

function blockexplorer_url(currency, tx, erc20) {
    if (erc20 == "true" || erc20 === true) {
        var tx_prefix = (tx === true) ? "tx/" : "address/";
        return "https://ethplorer.io/" + tx_prefix;
    } else {
        var blockexplorer = get_blockexplorer(currency);
        if (blockexplorer) {
            var blockdata = $.grep(br_config.blockexplorers, function(filter) { //filter pending requests	
                    return filter.name == blockexplorer;
                })[0],
                be_prefix = blockdata.prefix,
                coindata = getcoindata(currency),
                pfix = (be_prefix == "currencysymbol") ? coindata.ccsymbol : (be_prefix == "currency") ? currency : be_prefix,
                prefix = (pfix) ? pfix + "/" : "",
                prefix_type = (tx === true) ? blockdata.tx_prefix : blockdata.address_prefix;
            return blockdata.url + prefix + prefix_type;
        }
    }
}

function get_blockexplorer(currency) {
    return cs_dat(currency, "blockexplorers").selected;
}

function apisrc_shortcut() {
    $(document).on("click", ".api_source", function() {
        var rpc_settings_li = cs_node($(this).closest("li.rqli").data("payment"), "apis");
        if (rpc_settings_li) {
            rpc_settings_li.trigger("click");
        }
    })
}

function canceloptionstrigger() {
    $(document).on("click", "#optionspop, #closeoptions", function(e) {
        if (e.target == this) {
            canceloptions();
        }
    });
}

function canceloptions(pass) {
    if (pass === true) {
        clearoptions();
        return
    }
    var optionspop = $("#optionspop"),
        thishaspin = (optionspop.hasClass("pin"));
    if (thishaspin) {
        var phrasewrap = $("#lockscreen #phrasewrap");
        if (phrasewrap.hasClass("showph")) {
            phrasewrap.removeClass("showph");
            return
        }
        if (ishome() === true) {} else {
            if (html.hasClass("loaded")) {} else {
                shake(optionspop);
                return
            }
        }
    }
    clearoptions();
}

function clearoptions() {
    var optionspop = $("#optionspop");
    optionspop.addClass("fadebg");
    optionspop.removeClass("active");
    body.removeClass("blurmain_options");
    var timeout = setTimeout(function() {
        optionspop.removeClass("showpu pin fadebg ontop");
        $("#optionsbox").html("");
    }, 600, function() {
        clearTimeout(timeout);
    });
}

// ** Requestlist functions **

function showrequestdetails() {
    $(document).on("click", ".requestlist .liwrap", function() {
        var thisnode = $(this),
            thislist = thisnode.closest("li"),
            infopanel = thisnode.next(".moreinfo"),
            metalist = infopanel.find(".metalist");
        if (infopanel.is(":visible")) {
            infopanel.add(metalist).slideUp(200);
            thislist.removeClass("visible_request");
        } else {
            var fixednavheight = $("#fixednav").height();
            $(".requestlist > li").not(thislist).removeClass("visible_request");
            $(".moreinfo").add(".metalist").not(infopanel).slideUp(200);
            setTimeout(function() {
                $("html, body").animate({
                    "scrollTop": thislist.offset().top - fixednavheight
                }, 200);
                infopanel.slideDown(200);
                thislist.addClass("visible_request");
                var confbar = thislist.find(".transactionlist .confbar");
                if (confbar.length > 0) {
                    confbar.each(function(i) {
                        animate_confbar($(this), i);
                    });
                }
            }, 220);
        }
        thislist.find(".transactionlist .historic_meta").slideUp(200);
    });
}

function toggle_request_meta() {
    $(document).on("click", ".requestlist li .req_actions .icon-info", function() {
        var metalist = $(this).closest(".moreinfo").find(".metalist");
        if (metalist.is(":visible")) {
            metalist.slideUp(300);
            return
        }
        var confbar = metalist.find(".confbar");
        metalist.slideDown(300);
        if (confbar.length > 0) {
            confbar.each(function(i) {
                animate_confbar($(this), i);
            });
        }
    })
}

function animate_confbar(confbox, index) {
    confbox.css("transform", "translate(-100%)");
    var txdata = confbox.closest("li").data(),
        percentage = (txdata.confirmations / txdata.setconfirmations) * 100,
        percent_output = (percentage > 100) ? 100 : percentage,
        percent_final = (percent_output - 100).toFixed(2);
    setTimeout(function() {
        confbox.css("transform", "translate(" + percent_final + "%)");
    }, index * 500);
}

function show_transaction_meta() {
    $(document).on("dblclick", ".requestlist li .transactionlist li", function() {
        var thisli = $(this),
            txmeta = thisli.children(".historic_meta");
        if (txmeta.is(":visible")) {
            return
        }
        var txlist = thisli.closest(".transactionlist"),
            alltxmeta = txlist.find(".historic_meta");
        alltxmeta.not(txmeta).slideUp(300);
        txmeta.slideDown(300);
    })
}

function hide_transaction_meta() {
    $(document).on("click", ".requestlist li .transactionlist li", function() {
        var thisli = $(this),
            tx_meta = thisli.children(".historic_meta");
        if (tx_meta.is(":visible")) {
            tx_meta.slideUp(300);
        }
    })
}

function archive() {
    $(document).on("click", "#requestlist .req_actions .icon-folder-open", function() {
        popdialog("<h2 class='icon-folder-open'>Archive request?</h2>", "archivefunction", $(this));
    })
}

function archivefunction() {
    var thisreguest = $("#requestlist > li.visible_request"),
        requestdata = thisreguest.data(),
        requestcopy = thisreguest.clone();
    if (thisreguest.data("status") == "insufficient") {
        updaterequest({
            "requestid": requestdata.requestid,
            "status": "archive_pending"
        });
    }
    thisreguest.slideUp(300);
    requestcopy.data(requestdata).prependTo($("#archivelist"));
    setTimeout(function() {
        thisreguest.remove();
        savearchive();
        saverequests();
    }, 350);
    archive_button();
    canceldialog();
    notify("Moved to archive");
}

function unarchive() {
    $(document).on("click", "#archivelist .req_actions .icon-undo2", function() {
        popdialog("<h2 class='icon-undo2'>Unarchive request?</h2>", "unarchivefunction", $(this));
    })
}

function unarchivefunction() {
    var thisreguest = $("#archivelist li.visible_request"),
        requestdata = thisreguest.data(),
        requestcopy = thisreguest.clone();
    thisreguest.slideUp(300);
    requestcopy.data(requestdata).prependTo($("#requestlist"));
    setTimeout(function() {
        thisreguest.remove();
        savearchive();
        saverequests();
        archive_button();
    }, 350);
    canceldialog();
    notify("Request restored");
}

function removerequest() {
    $(document).on("click", ".req_actions .icon-bin", function() {
        popdialog("<h2 class='icon-bin'>Delete request?</h2>", "removerequestfunction", $(this));
    })
}

function removerequestfunction() {
    var result = confirm("Are you sure?");
    if (result === true) {
        var visiblerequest = $(".requestlist > li.visible_request");
        visiblerequest.slideUp(300);
        setTimeout(function() {
            visiblerequest.remove();
            saverequests();
            savearchive();
        }, 350);
        canceldialog();
        notify("Request deleted 🗑");
    }
}

// ** Helpers **

function open_url() {
    $(document).on("click", "a.exit", function(e) {
        e.preventDefault();
        var this_href = $(this),
            target = this_href.attr("target"),
            url = this_href.attr("href");
        loader(true);
        loadertext("Loading " + url);
        if (is_ios_app === true) {
            cancelpaymentdialog();
        }
        setTimeout(function() {
            closeloader();
            if (target == "_blank") {
                window.open(url);
            } else {
                w_loc.href = url;
            }
        }, 500);
    })
}

function get_blockcypher_apikey() {
    var savedkey = $("#apikeys").data("blockcypher");
    return (savedkey) ? savedkey : to.bc_id;
}

function get_amberdata_apikey() {
    var savedkey = $("#apikeys").data("amberdata");
    return (savedkey) ? savedkey : to.ad_id;
}

function get_infura_apikey(rpcurl) {
    var savedkey = $("#apikeys").data("infura");
    return (/^[A-Za-z0-9]+$/.test(rpcurl.slice(rpcurl.length - 15))) ? "" : // check if rpcurl already contains apikey
        (savedkey) ? savedkey : to.if_id;
}

function api_proxy(ad, p_proxy) {
    var custom_url = (ad.api_url) ? ad.api_url : false,
        aud = (custom_url) ? {} :
        get_api_url({
            "api": ad.api,
            "search": ad.search
        });
    if (aud) {
        var proxy = ad.proxy,
            api_key = aud.api_key,
            set_key = (api_key) ? true : false,
            nokey = (api_key == "no_key") ? true : false,
            key_pass = (nokey === true || set_key === true);
        if (proxy === false || (proxy !== true && key_pass === true)) {
            var params = ad.params,
                bearer = ad.bearer;
            params.url = (custom_url) ? custom_url : aud.api_url_key;
            if (bearer && api_key) {
                if (bearer == "amberdata") {
                    params.headers["x-api-key"] = api_key;
                } else {
                    if (params.headers) {
                        params.headers["Authorization"] = "Bearer " + api_key;
                    } else {
                        var auth = {
                            "Authorization": "Bearer " + api_key
                        }
                        params.headers = auth;
                    }
                }
            }
            return $.ajax(params);
        }
        // use api proxy
        var api_location = "proxy/v1/",
            set_proxy = (p_proxy) ? p_proxy : d_proxy(),
            app_root = (ad.localhost) ? "" : set_proxy,
            proxy_data = {
                "method": "POST",
                "cache": false,
                "timeout": 5000,
                "url": app_root + api_location,
                "data": $.extend(ad, aud, {
                    "nokey": nokey
                })
            };
        return $.ajax(proxy_data);
    }
    return $.ajax();
}

function br_result(e) {
    var ping = e.ping,
        proxy = (ping) ? true : false;
    if (proxy && ping.br_cache) {
        var version = ping.br_cache.version;
        if (version != proxy_version) {
            proxy_alert(version);
        }
    }
    return {
        "proxy": proxy,
        "result": (proxy) ? (ping.br_cache) ? ping.br_result : ping : e
    }
}

function proxy_alert(version) {
    if (version) {
        body.addClass("haschanges");
        $("#alert > span").text("!").attr("title", "Please update your proxy server " + version + " > " + proxy_version);
    }
}

function get_api_url(get) {
    var api = get.api,
        ad = get_api_data(api);
    if (ad) {
        var search = (get.search) ? get.search : "",
            base_url = ad.base_url,
            key_param = (ad.key_param) ? ad.key_param : "",
            saved_key = $("#apikeys").data(api),
            key_val = (saved_key) ? saved_key : ad.api_key,
            ampersand = (search) ? (search.indexOf("?") > -1 || search.indexOf("&") > -1) ? "&" : "?" : "",
            api_param = (key_param != "bearer" && saved_key) ? ampersand + key_param + saved_key : "",
            api_url = base_url + search;
        return {
            "api_url": api_url,
            "api_url_key": api_url + api_param,
            "api_key": key_val,
            "ampersand": ampersand,
            "key_param": key_param
        }
    }
    return false
}

function fetchsymbol(currencyname) {
    var ccsymbol = {};
    $.each(JSON.parse(localStorage.getItem("bitrequest_erc20tokens")), function(key, value) {
        if (value.name == currencyname) {
            ccsymbol.symbol = value.symbol;
            ccsymbol.id = value.cmcid;
            return
        }
    });
    return ccsymbol;
}

Number.prototype.toFixedSpecial = function(n) {
    var str = this.toFixed(n);
    if (str.indexOf("e+") < 0) {
        return str;
    }
    var convert = str.replace(".", "").split("e+").reduce(function(p, b) {
        return p + Array(b - p.length + 2).join(0);
    }) + "." + Array(n + 1).join(0);
    return convert.slice(0, -1);
};

function fixedcheck(livetop) {
    var headerheight = $(".showmain #header").outerHeight();
    if (livetop > headerheight) {
        $(".showmain").addClass("fixednav");
        return
    }
    $(".showmain").removeClass("fixednav");
}

function geturlparameters() {
    var qstring = w_loc.search.substring(1),
        xss = xss_search(qstring);
    if (xss) {
        return "xss";
    }
    var getvalues = qstring.split("&"),
        get_object = {};
    $.each(getvalues, function(i, val) {
        var keyval = val.split("=");
        get_object[keyval[0]] = keyval[1];
    });
    var dp = get_object.d,
        mp = get_object.m;
    if (dp) {
        var isxx = scanmeta(dp);
        if (isxx) {
            return "xss";
        }
    }
    if (mp) {
        var isxx = scanmeta(mp);
        if (isxx) {
            return "xss";
        }
    }
    return get_object;
}

function scanmeta(val) {
    var isd = (val && val.length > 5) ? atob(val) : false,
        xssdat = xss_search(isd);
    if (xssdat) { //xss detection
        return true
    }
    return false
}

function xss_search(val) {
    if (val) {
        if (val.indexOf("<scrip") > -1) {
            vibrate();
            notify(xss_alert);
            return true
        }
        if (val.indexOf("onerror") > -1) {
            vibrate();
            notify(xss_alert);
            return true
        }
    }
    return false
}

function ishome(pagename) {
    var page = (pagename) ? pagename : geturlparameters().p;
    return (!page || page == "home");
}

function triggersubmit(trigger) {
    trigger.parent("#actions").prev("#dialogbody").find("input.submit").trigger("click");
}

function copytoclipboard(content, type) {
    var copy_api = navigator.clipboard;
    if (copy_api) {
        navigator.clipboard.writeText(content);
        notify(type + " copied to clipboard", 2500, "no");
        return
    }
    copycontent.val(content);
    copycontent[0].setSelectionRange(0, 999);
    try {
        var success = document.execCommand("copy");
        if (success) {
            notify(type + " copied to clipboard", 2500, "no");
        } else {
            notify("Unable to copy " + type, 2500, "no");
        }
    } catch (err) {
        notify("Unable to copy " + type, 2500, "no");
    }
    copycontent.val("").data({
        "type": false
    }).blur();
}

function getrandomnumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function hashcode(str) {
    if (str) {
        return Math.abs(str.split("").reduce(function(a, b) {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a
        }, 0));
    }
    return false;
}

function loader(top) {
    var loader = $("#loader"),
        class_string = (top === true) ? "showpu active toploader" : "showpu active";
    $("#loader").addClass(class_string);
}

function closeloader_trigger() {
    $(document).on("click", "#loader", function() {
        closeloader();
    })
}

function closeloader() {
    $("#loader").removeClass("showpu active toploader");
    loadertext("loading");
}

function loadertext(text) {
    $("#loader #loadtext > span").text(text);
}

function settitle(title) {
    titlenode.text(title);
    ogtitle.attr("content", title);
}

function getcc_icon(cmcid, cpid, erc20) {
    if (erc20) {
        if (offline === true) {
            return "<img src='" + c_icons("ph") + "' class='cmc_icon'/>";
        }
        return "<img src='" + cmc_icon_loc + cmcid + ".png' class='cmc_icon'/>";
    }
    return "<img src='" + c_icons(cpid) + "' class='cmc_icon'/>";
}

function getdevicetype() {
    var ua = userAgent;
    return (is_android_app === true) ? "android-app" :
        (is_ios_app === true) ? "apple-app" :
        (/iPad/.test(ua)) ? "iPad" :
        (/iPhone/.test(ua)) ? "iPhone" :
        (/Android/.test(ua)) ? "Android" :
        (/Macintosh/.test(ua)) ? "Macintosh" :
        (/Windows/.test(ua)) ? "Windows" :
        "unknown";
};

function getplatform(device) {
    return (supportsTouch === true) ?
        (is_android_app === true || device == "Android" || device == "Windows") ? "playstore" :
        (device == "iPhone" || device == "iPad" || device == "Macintosh" || is_ios_app === true) ? "appstore" : "unknown" :
        (device == "Windows") ? "desktop" :
        (device == "Macintosh") ? "desktop" : "unknown";
}

function makedatestring(datetimeparts) {
    var split = (datetimeparts.indexOf(".") > -1) ? "." : "Z";
    return datetimeparts[0] + " " + datetimeparts[1].split(split)[0];
}

function returntimestamp(datestring) {
    var datetimeparts = datestring.split(" "),
        timeparts = datetimeparts[1].split(":"),
        dateparts = datetimeparts[0].split("-");
    return new Date(dateparts[0], parseInt(dateparts[1], 10) - 1, dateparts[2], timeparts[0], timeparts[1], timeparts[2]);
}

function to_ts(ts) {
    if (ts) {
        var tstamp = ts.split("T");
        return (tstamp) ? returntimestamp(makedatestring(tstamp)).getTime() : null;
    }
    return null;
}

function short_date(txtime) {
    return new Date(txtime - timezone).toLocaleString(language, {
        "day": "2-digit", // numeric, 2-digit
        "month": "2-digit", // numeric, 2-digit, long, short, narrow
        "year": "2-digit", // numeric, 2-digit
        "hour": "numeric", // numeric, 2-digit
        "minute": "numeric"
    })
}

function weekdays(day) {
    return {
        "0": "Sunday",
        "1": "Monday",
        "2": "Tuesday",
        "3": "Wednesday",
        "4": "Thursday",
        "5": "Friday",
        "6": "Saturday"
    };
}

function fulldateformat(date, lng) {
    return weekdays()[date.getDay()] + " " + date.toLocaleString(lng, {
        "month": "long"
    }) + " " + date.getDate() + " | " + formattime(date);
}

function fulldateformatmarkup(date, lng) {
    return weekdays()[date.getDay()] + " " + date.toLocaleString(lng, {
        "month": "long"
    }) + " " + date.getDate() + " | <div class='fdtime'>" + formattime(date) + "</div>";
}

function formattime(date) {
    var h = date.getHours(),
        m = date.getMinutes(),
        s = date.getSeconds(),
        hours = (h < 10) ? "0" + h : h,
        minutes = (m < 10) ? "0" + m : m,
        seconds = (s < 10) ? "0" + s : s;
    return " " + hours + ":" + minutes + ":" + seconds;
}

function playsound(audio) {
    var promise = audio[0].play();
    if (promise) {
        promise.then(_ => {
            // Autoplay started!
        }).catch(error => {
            // Fallback
        });
    }
}

function vibrate() {
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
}

function get_api_data(api_id) {
    var apipath = br_config.apis.filter(function(val) {
        return val.name == api_id;
    });
    return apipath[0];
}

function all_pinpanel(cb, top) {
    var topclass = (top) ? " ontop" : "";
    if (haspin() === true) {
        var lastlock = localStorage.getItem("bitrequest_locktime"),
            tsll = now() - lastlock,
            pass = (tsll < 10000);
        if (cb && pass) { // keep unlocked in 10 second time window
            cb.func(cb.args);
            return
        }
        var content = pinpanel(" pinwall", cb);
        showoptions(content, "pin" + topclass);
        return
    }
    var content = pinpanel("", cb);
    showoptions(content, "pin" + topclass);
}

function pinpanel(pinclass, pincb) {
    var makeclass = (pinclass === undefined) ? "" : pinclass,
        headertext = (haspin() === true) ? "Please enter your pin" : "Create a 4-digit pin";
    return $("<div id='pinfloat' class='enterpin" + makeclass + "'>\
		<p id='pintext'>" + headertext + "</p>\
		<p id='confirmpin'>Confirm your pin</p>\
		<input id='pininput' type='password' readonly='readonly'/>\
		<input id='validatepin' type='password' readonly='readonly'/>\
		<div id='pinkeypad'>\
			<div id='pin1' class='pinpad flex'>\
				<span class='pincell'>1</span>\
			</div>\
			<div id='pin2' class='pinpad'>\
				<span class='pincell'>2</span>\
			</div>\
			<div id='pin3' class='pinpad'>\
				<span class='pincell'>3</span>\
			</div><br>\
			<div id='pin4' class='pinpad'>\
				<span class='pincell'>4</span>\
			</div>\
			<div id='pin5' class='pinpad'>\
				<span class='pincell'>5</span>\
			</div>\
			<div id='pin6' class='pinpad'>\
				<span class='pincell'>6</span>\
			</div><br>\
			<div id='pin7' class='pinpad'>\
				<span class='pincell'>7</span>\
			</div>\
			<div id='pin8' class='pinpad'>\
				<span class='pincell'>8</span>\
			</div>\
			<div id='pin9' class='pinpad'>\
				<span class='pincell'>9</span>\
			</div><br>\
			<div id='locktime' class='pinpad'>\
				<span class='icomoon'></span>\
			</div>\
			<div id='pin0' class='pinpad'>\
				<span class='pincell'>0</span>\
			</div>\
			<div id='pinback' class='pinpad'>\
				<span class='icomoon'></span>\
			</div>\
		</div>\
		<div id='pin_admin' class='flex'>\
			<div id='pin_admin_float'>\
				<div id='lock_time'><span class='icomoon'></span> Lock time</div>\
				<div id='reset_pin'>Reset pin</div>\
			</div>\
		</div>\
	</div>").data("pincb", pincb);
}

function switchpanel(switchmode, mode) {
    return "<div class='switchpanel " + switchmode + mode + "'><div class='switch'></div></div>"
}

function getcoindata(currency) {
    var coindata_object = getcoinconfig(currency);
    if (coindata_object) {
        var coindata = coindata_object.data,
            settings = coindata_object.settings,
            has_settings = (settings) ? true : false,
            is_monitored = (settings) ? (settings.apis) ? true : false : false,
            cd_object = {
                "currency": coindata.currency,
                "ccsymbol": coindata.ccsymbol,
                "cmcid": coindata.cmcid,
                "monitored": is_monitored,
                "urlscheme": coindata.urlscheme,
                "settings": has_settings,
                "regex": coindata.address_regex,
                "erc20": false
            };
        return cd_object;
    } // if not it's probably erc20 token
    var currencyref = $("#usedcurrencies li[data-currency='" + currency + "']"); // check if erc20 token is added
    if (currencyref.length > 0) {
        return $.extend(currencyref.data(), br_config.erc20_dat.data);
    } // else lookup erc20 data
    var tokenobject = JSON.parse(localStorage.getItem("bitrequest_erc20tokens"));
    if (tokenobject) {
        var erc20data = $.grep(tokenobject, function(filter) {
            return filter.name == currency;
        })[0];
        if (erc20data) {
            var fetched_data = {
                "currency": erc20data.name,
                "ccsymbol": erc20data.symbol,
                "cmcid": erc20data.cmcid.toString(),
                "contract": erc20data.contract
            }
            return $.extend(fetched_data, br_config.erc20_dat.data);
        }
    }
    return false;
}

function activecoinsettings(currency) {
    var saved_coinsettings = JSON.parse(localStorage.getItem("bitrequest_" + currency + "_settings"));
    return (saved_coinsettings) ? saved_coinsettings : getcoinsettings(currency);
}

function getcoinsettings(currency) {
    var coindata = getcoinconfig(currency);
    if (coindata) {
        return coindata.settings;
    } // return erc20 settings
    return br_config.erc20_dat.settings;
}

function getbip32dat(currency) {
    var xpub_dat = cs_dat(currency, "Xpub");
    if (xpub_dat && xpub_dat.active === true) {
        return xpub_dat;
    }
    var coindata = getcoinconfig(currency);
    if (coindata) {
        var xpubdat = coindata.settings.Xpub;
        if (xpubdat && xpubdat.active === true) {
            return xpubdat;
        }
    }
    return false;
}

function hasbip32(currency) {
    var coindata = getcoinconfig(currency);
    if (coindata) {
        var settings = coindata.settings;
        if (settings) {
            var xpub = settings.Xpub;
            if (xpub) {
                if (xpub.active) {
                    return true;
                }
            }
        }
    }
    return false;
}

function getcoinconfig(currency) {
    return $.grep(br_config.bitrequest_coin_data, function(filter) {
        return filter.currency == currency;
    })[0];
}

function try_next_api(apilistitem, current_apiname) {
    var apilist = br_config.apilists[apilistitem],
        next_scan = apilist[$.inArray(current_apiname, apilist) + 1],
        next_api = (next_scan) ? next_scan : apilist[0];
    if (api_attempt[apilistitem][next_api] === true) {
        return false;
    }
    return next_api;
}

function wake() {
    if (wl) {
        const requestwakelock = async () => {
            try {
                wakelock = await wl.request("screen");
                wakelock.addEventListener("release", (e) => {
                    //console.log(e);
                });
            } catch (e) {
                console.error(e.name, e.message);
            }
        };
        requestwakelock();
    }
}

function sleep() {
    if (wl) {
        console.log(wakelock);
        if (wakelock) {
            wakelock.release();
        }
        wakelock = null;
    }
}

function vu_block() {
    notify("Not allowed in cashier mode");
    playsound(funk);
}

// Fix decimals
function trimdecimals(amount, decimals) {
    var round_amount = parseFloat(amount).toFixed(decimals);
    return parseFloat(round_amount.toString());
}

// Countdown format

function countdown(timestamp) {
    var uts = timestamp / 1000,
        days = Math.floor(uts / 86400);
    uts -= days * 86400;
    var hours = Math.floor(uts / 3600) % 24;
    uts -= hours * 3600;
    var minutes = Math.floor(uts / 60) % 60;
    uts -= minutes * 60;
    var seconds = uts % 60,
        cd_object = {
            "days": days,
            "hours": hours,
            "minutes": minutes,
            "seconds": Math.round(seconds)
        }
    return cd_object;
}

function countdown_format(cd) {
    var days = cd.days,
        hours = cd.hours,
        minutes = cd.minutes,
        seconds = cd.seconds,
        daynode = (days) ? (days < 2) ? days + " day" : days + " days" : "",
        hs = (days) ? ", " : "",
        hournode = (hours) ? (hours < 2) ? hs + hours + " hour" : hs + hours + " hours" : "",
        ms = (hours) ? ", " : "",
        minutenode = (minutes) ? (minutes < 2) ? ms + minutes + " minute" : ms + minutes + " minutes" : "",
        ss = (minutes) ? " and " : "",
        secondnode = (seconds) ? ss + seconds + " seconds" : "",
        result = (cd) ? daynode + hournode + minutenode + secondnode : false;
    return result;
}

function adjust_objectarray(array, mods) {
    var newarray = array;
    $.each(mods, function(i, val) {
        var index = array.findIndex((obj => obj.id == val.id));
        newarray[index][val.change] = val.val;
    });
    return newarray;
}

// ** Page rendering **

//render page from cache
function rendercurrencies() {
    initiate();
    if (stored_currencies) {
        $.each(JSON.parse(stored_currencies), function(index, data) {
            var thiscurrency = data.currency,
                thiscmcid = data.cmcid;
            buildpage(data, false);
            render_currencysettings(thiscurrency);
            var addresses = localStorage.getItem("bitrequest_cc_" + thiscurrency);
            if (addresses) {
                $.each(JSON.parse(addresses).reverse(), function(index, address_data) {
                    appendaddress(thiscurrency, address_data);
                });
            }
        });
    }
    $("ul#allcurrencies").append("<li id='choose_erc20' data-currency='erc20 token' class='start_cli' data-currency='erc20 token'><div class='liwrap'><h2><img src='" + c_icons("ph") + "'/>erc20 token</h2></div></li>\
	<li id='rshome' class='restore start_cli' data-currency='erc20 token'><div class='liwrap'><h2><span class='icon-upload'> Restore from backup</h2></div></li><li id='start_cli_margin' class='start_cli'><div class='liwrap'><h2></h2></div></li>");
}

// render currency settings
function render_currencysettings(thiscurrency) {
    var settingcache = localStorage.getItem("bitrequest_" + thiscurrency + "_settings");
    if (settingcache) {
        append_coinsetting(thiscurrency, JSON.parse(settingcache), false);
    }
}

// build settings
function buildsettings() {
    var appsettingslist = $("#appsettings");
    $.each(br_config.app_settings, function(i, value) {
        var setting_id = value.id,
            setting_li = (setting_id == "heading") ? $("<li class='set_heading'>\
		  	<h2>" + value.heading + "</h2>\
		</li>") :
            $("<li class='render' id='" + setting_id + "'>\
		  	<div class='liwrap iconright'>\
		     	<span class='" + value.icon + "'></span>\
		         <div class='atext'>\
		            <h2>" + value.heading + "</h2>\
		            <p>" + value.selected + "</p>\
		         </div>\
		         <div class='iconbox'>\
				 	<span class='icon-pencil'></span>\
				</div>\
		  	</div>\
		</li>");
        setting_li.data(value).appendTo(appsettingslist);
    });
}

// render settings
function rendersettings(excludes) {
    var settingcache = localStorage.getItem("bitrequest_settings");
    if (settingcache) {
        $.each(JSON.parse(settingcache), function(i, value) {
            if ($.inArray(value.id, excludes) === -1) { // exclude excludes
                $("#" + value.id).data(value).find("p").text(value.selected);
            }
        });
    }
}

function renderrequests() {
    fetchrequests("bitrequest_requests", false);
    fetchrequests("bitrequest_archive", true);
    archive_button();
}

function archive_button() {
    var viewarchive = $("#viewarchive"),
        archivecount = $("#archivelist > li").length;
    if (archivecount > 0) {
        va_title = viewarchive.attr("data-title");
        viewarchive.slideDown(300).text(va_title + " (" + archivecount + ")");
        return
    }
    viewarchive.slideUp(300);
}

function fetchrequests(cachename, archive) {
    var requestcache = localStorage.getItem(cachename);
    if (requestcache) {
        var parsevalue = JSON.parse(requestcache),
            showarchive = (archive === false && parsevalue.length > 11); // only show archive button when there are more then 11 requests
        $.each(parsevalue.reverse(), function(i, value) {
            value.archive = archive;
            value.showarchive = showarchive;
            appendrequest(value);
        });
    }
}

//initiate page when there's no cache
function initiate() {
    $.each(br_config.bitrequest_coin_data, function(dat, val) {
        if (val.active === true) {
            var settings = val.settings,
                has_settings = (settings) ? true : false,
                is_monitored = (has_settings) ? (settings.apis) ? true : false : false,
                cd = val.data,
                coindata = {
                    "currency": cd.currency,
                    "ccsymbol": cd.ccsymbol,
                    "checked": false,
                    "cmcid": cd.cmcid,
                    "erc20": false,
                    "monitored": is_monitored,
                    "settings": has_settings,
                    "urlscheme": cd.urlscheme
                };
            buildpage(coindata, true);
            append_coinsetting(val.currency, settings, true);
        }
    });
}

function buildpage(cd, init) {
    var currency = cd.currency,
        ccsymbol = cd.ccsymbol,
        checked = cd.checked,
        cmcid = cd.cmcid,
        cpid = ccsymbol + "-" + currency,
        erc20 = cd.erc20,
        // append currencies
        currencylist = $("ul#usedcurrencies"),
        cc_li = currencylist.children("li[data-currency='" + currency + "']"),
        home_currencylist = $("ul#currencylist"),
        home_cc_li = home_currencylist.children("li[data-currency='" + currency + "']"),
        visibility = (checked === true) ? "" : "hide",
        has_settings = (cd.settings === true || erc20 === true),
        init = (cc_li.length === 0 && init === true);
    if (init === true || erc20 === true) {
        var new_li = $("<li class='iconright' data-currency='" + currency + "' data-checked='" + checked + "'>\
			<div data-rel='?p=" + currency + "' class='liwrap addcurrency'>\
				<h2>" + getcc_icon(cmcid, cpid, erc20) + " " + currency + "\</h2>\
			</div>\
			<div class='iconbox togglecurrency'>\
				<span class='checkbox'></span>\
			</div>\
		</li>");
        new_li.data(cd).appendTo(currencylist);
        // append currencies homepage
        var new_homeli = $("<li class='" + visibility + "' data-currency='" + currency + "'>\
			<div class='rq_icon' data-rel='?p=home&payment=" + currency + "&uoa=' data-title='create " + currency + " request' data-currency='" + currency + "'>" +
            getcc_icon(cmcid, cpid, erc20) + "\
			</div>\
		</li>");
        new_homeli.data(cd).appendTo(home_currencylist);
        var settingspage = (has_settings === true) ? "\
		<div class='page' id='" + currency + "_settings' data-erc20='" + erc20 + "'>\
			<div class='content'>\
				<h2 class='heading'>" + getcc_icon(cmcid, cpid, erc20) + " " + currency + " settings</h2>\
				<ul class='cc_settinglist settinglist applist listyle2'></ul>\
				<div class='reset_cc_settings button' data-currency='" + currency + "'>\
					<span>Reset</span>\
				</div>\
			</div>\
		</div>" : "";
        var settingsbutton = (has_settings === true) ? "<div data-rel='?p=" + currency + "_settings' class='self icon-cog'></div>" : "",
            sendbttn = (hasbip === true) ? "<div class='button send' data-currency='" + currency + "'><span class='icon-telegram'>Send</span></div>" : "",
            currency_page = $("<div class='page' id='" + currency + "'>\
			<div class='content'>\
				<h2 class='heading'>" + getcc_icon(cmcid, cpid, erc20) + " " + currency + settingsbutton + "</h2>\
				<ul class='applist listyle2 pobox' data-currency='" + currency + "'>\
					<div class='endli'><div class='button addaddress' data-currency='" + currency + "'><span class='icon-plus'>Add address</span></div>" + sendbttn + "</div>\
					<div class='addone' data-currency='" + currency + "'>Add one</div>\
				</ul>\
			</div>\
		</div>" + settingspage);
        currency_page.data(cd).appendTo("main");
        if (erc20 === true) {
            var coin_settings_cache = localStorage.getItem("bitrequest_" + currency + "_settings");
            if (!coin_settings_cache) {
                localStorage.setItem("bitrequest_" + currency + "_settings", JSON.stringify(br_config.erc20_dat.settings));
            }
        }
    } else {
        cc_li.data(cd).attr("data-checked", checked);
        home_cc_li.data(cd).removeClass("hide").addClass(visibility);
    }
    $("ul#allcurrencies").append("<li class='start_cli choose_currency' data-currency='" + currency + "' data-checked='" + checked + "'>\
		<div data-rel='?p=" + currency + "' class='liwrap'>\
			<h2>" + getcc_icon(cmcid, cpid, erc20) + " " + currency + "\</h2>\
		</div>\
	</li>");
}

function append_coinsetting(currency, settings, init) {
    var coinsettings_list = $("#" + currency + "_settings ul.cc_settinglist");
    $.each(settings, function(dat, val) {
        if (val.xpub === false) {} else {
            var selected = val.selected,
                selected_val = (selected.name) ? selected.name : (selected.url) ? selected.url : selected;
            if (selected_val !== undefined) {
                var selected_string = selected_val.toString(),
                    ss_filter = (selected_string == "true" || selected_string == "false") ? "" : selected_string,
                    check_setting_li = coinsettings_list.children("li[data-id='" + dat + "']");
                if (check_setting_li.length === 0) {
                    var switchclass = (val.custom_switch) ? " custom" : " global bool",
                        trigger = (val.switch === true) ? switchpanel(selected_string, switchclass) : "<span class='icon-pencil'></span>",
                        coinsettings_li = $("<li data-id='" + dat + "'>\
							<div class='liwrap edit_trigger iconright' data-currency='" + currency + "'>\
								<span class='icon-" + val.icon + "'></span>\
								<div class='atext'>\
									<h2>" + dat + "</h2>\
									<p>" + ss_filter + "</p>\
								</div>\
								<div class='iconbox'>" + trigger + "</div>\
								</div>\
						</li>");
                    coinsettings_li.data(val).appendTo(coinsettings_list);
                } else {
                    check_setting_li.data(val).find("p").text(ss_filter);
                    if (val.switch === true) {
                        check_setting_li.find(".switchpanel").removeClass("true false").addClass(selected_string);
                    }
                }
            }
        }
    });
}

function appendaddress(currency, ad) {
    var address = ad.address,
        pobox = get_addresslist(currency),
        index = pobox.children("li").length + 1,
        seedid = ad.seedid,
        addressid = ad.a_id,
        xpubid = ad.xpubid,
        source = (seedid) ? "seed" : (xpubid) ? "xpub" : "",
        used = ad.used,
        ad_id_str = (addressid) ? "address_ID: " + addressid + "\n" : "",
        ad_icon = (source) ? (source == "seed") ? "<span title='" + ad_id_str + "seed_ID: " + seedid + "' class='srcicon' data-seedid='" + seedid + "'><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 888 899' class='srcseed'><path d='M852.9 26.3c.5-3.5-28.7 14.8-28.2 14.1-.9 1.1-25.3 23.4-195.1 46-71.4 9.5-120.3 37.2-145.3 82.4-40.3 72.6-1.1 161 .6 164.7l1.6 3.5c-7.8 16.8-14.1 34.2-19.3 51.9-11.6-27.1-26.5-50.9-44.8-71.4 4.8-20.2 5-45.5-3.8-77.1-21.1-76.1-73.8-104.4-114.2-114.7-42.3-10.8-79.6-4.1-81.2-3.9l-.7.1c-1.8.4-44.8 10-90.8 38.1C69.2 198.3 31 252.7 21.3 317.2L16 353.5l35-11.1c2.7-.8 66.4-20.2 150.4 29.6 32.6 19.3 68.6 29 102 29 30.8 0 59.4-8.2 81.1-24.8 5.4-4.1 11.5-9.6 17.3-16.8 24.5 33 40.5 75.2 47.9 126.3-.8 9.5-1.3 19-1.7 28.4-70.6 10.5-187.2 47.6-280.8 173 0 0 59.9 179.7 264.3 183.3 204.4 3.5 194.6 0 194.6 0s137.6-7 126.6-183.3-241.3-176.6-241.3-176.6-5.9-.5-16.3-.4c-.2-2.7-.4-5.4-.7-8.1 3.2-52.1 13.1-97.9 29.5-136.7 38.8 24.8 75.7 37.3 110.6 37.3 18.5 0 36.4-3.5 53.7-10.5C824 336.9 862.7 78.4 866.5 50.6c.3-1.6-6.6 14.4.5-4.9s-14.1-19.4-14.1-19.4zM356.8 339.8C326.5 363 271 360 224.9 332.6c-54.8-32.5-103.6-40.3-137.8-40.3-4.4 0-8.6.1-12.5.4 34.8-95.2 149.9-124.1 157.2-125.8 8.8-1.5 114.1-16.6 142.6 85.9 2.3 8.3 4.2 17.5 4.9 26.9-93-63.9-206.9-45.3-210.2-45-31.7 13.8-17.6 42 7.1 41.7 24.4-.4 113.8-18 193.8 49.1-3.4 5.3-7.7 10.1-13.2 14.3zm314.2 9.9c-36 14.6-78.2 6.2-125.6-25 8.2-12.9 17.4-24.7 27.6-35.3 40.2-41.9 84-53.8 96.3-56.4.9-.1 2-.2 3.3-.6h.2c17-5.6 25.1-43.8-6-45.4-.6-2-66.2 9.2-124.4 68.3-9.2 9.4-17.6 19.3-25.2 29.6-6.1-25.6-9.9-63 7.3-94 17.7-31.7 55.1-51.6 111.2-59 79.7-10.6 138.5-23.2 176.8-37.9-18.8 88.1-63.2 223.8-141.5 255.7z' fill='#B33A3A'/></svg></span>" : "<span class='srcicon icon-key' title='" + ad_id_str + "derived from Xpub: #" + xpubid + "'></span>" : (currency == "monero") ? (ad.vk) ? "<span class='srcicon icon-eye' title='Monitored address'></span>" : "<span class='srcicon icon-eye-blocked' title='Unmonitored address'></span>" : "",
        activepub = active_xpub(currency),
        clasv = (source) ? (source == "seed") ? (seedid == bipid) ? " seed seedv" : " seed seedu" :
        (source == "xpub") ? (activepub && xpubid == activepub.key_id) ? " xpub xpubv" : " xpub xpubu" : "" : "",
        usedcl = (used) ? " used" : "",
        address_li = $("<li class='adli" + clasv + usedcl + "' data-index='" + index + "' data-address='" + address + "' data-checked='" + ad.checked + "'>\
			<div class='addressinfo liwrap iconright2'>\
				<div class='atext'>\
					<h2><span>" + ad.label + "</span></h2>\
					<p class='address'>" + ad_icon + "<span class='select'>" + address + "</span><span class='usedicon icon-arrow-up-right2' title='Used'></span></p>\
				</div>\
				<div class='iconbox'>\
					<span class='checkbox toggleaddress'></span>\
					<span class='popoptions icon-menu2'></span>\
				</div>\
			</div>\
		</li>");
    address_li.data(ad).prependTo(pobox);
}

function appendrequest(rd) {
    var payment = rd.payment,
        erc20 = rd.erc20,
        uoa = rd.uoa,
        amount = rd.amount,
        address = rd.address,
        payment_id = rd.payment_id,
        xmr_ia = rd.xmr_ia,
        currencysymbol = rd.currencysymbol,
        cmcid = rd.cmcid,
        cpid = rd.cpid,
        requesttype = rd.requesttype,
        iscrypto = rd.iscrypto,
        requestname = rd.requestname,
        requesttitle = rd.requesttitle,
        set_confirmations = rd.set_confirmations,
        currencyname = rd.currencyname,
        receivedamount = rd.receivedamount,
        fiatvalue = rd.fiatvalue,
        txhash = rd.txhash,
        lnhash = (txhash && txhash.slice(0, 9) == "lightning") ? true : false,
        lightning = rd.lightning,
        hybrid = (lightning && lightning.hybrid === true),
        conf = (rd.confirmations) ? rd.confirmations : 0,
        status = rd.status,
        pending = rd.pending,
        requestid = rd.requestid,
        archive = rd.archive,
        showarchive = rd.showarchive,
        timestamp = rd.timestamp,
        requestdate = rd.requestdate,
        rqdata = rd.rqdata,
        rqmeta = rd.rqmeta,
        ismonitored = rd.monitored,
        source = rd.source,
        txhistory = rd.txhistory,
        uoa_upper = uoa.toUpperCase(),
        deter = (iscrypto === true) ? 6 : 2,
        insufficient = (status == "insufficient"),
        requesttitle_short = (requesttitle && requesttitle.length > 85) ? "<span title='" + requesttitle + "'>" + requesttitle.substring(0, 64) + "...</span>" : requesttitle,
        // Fix decimal rounding:
        amount_rounded = trimdecimals(amount, deter),
        receivedamount_rounded = trimdecimals(receivedamount, 6),
        fiatvalue_rounded = trimdecimals(fiatvalue, 2),
        requestlist = (archive === true) ? $("#archivelist") : $("#requestlist"),
        utc = timestamp - timezone,
        localtime = (requestdate) ? requestdate - timezone : utc, // timezone correction
        paymenttimestamp = (rd.paymenttimestamp) ? rd.paymenttimestamp : requestdate,
        incoming = (requesttype == "incoming"),
        local = (requesttype == "local"),
        checkout = (requesttype == "checkout"),
        outgoing = (requesttype == "outgoing"),
        direction = (incoming === true) ? "sent" : "received",
        typetext = (checkout) ? "online purchase" : (local) ? "point of sale" : requesttype,
        requesticon = (checkout) ? " typeicon icon-cart" : (local) ? " icon-qrcode" : (incoming === true) ? " typeicon icon-arrow-down-right2" : " typeicon icon-arrow-up-right2",
        typeicon = "<span class='inout" + requesticon + "'></span> ",
        statusicon = "<span class='icon-checkmark' title='Confirmed transaction'></span>\
			<span class='icon-clock' title='pending transaction'></span>\
			<span class='icon-eye-blocked' title='unmonitored transaction'></span>\
			<span class='icon-wifi-off' title='No network'></span>",
        requesttitlestring = (rqdata || requesttitle) ? (incoming === true) ? requestname : requesttitle_short : "<b>" + amount_rounded + "</b> " + currencyname + statusicon,
        requestnamestring = (rqdata || requesttitle) ? (incoming === true) ? "<strong>'" + requesttitle_short + "'</strong> (" + amount_rounded + " " + currencyname + ")" + statusicon : amount_rounded + " " + currencyname + statusicon : "",
        rqdataparam = (rqdata) ? "&d=" + rqdata : "",
        rqmetaparam = (rqmeta) ? "&m=" + rqmeta : "",
        requesttypeclass = "request" + requesttype,
        lnclass = (lightning) ? " lightning" : "",
        lnd_expire = (lightning && hybrid === false || lnhash) ? true : false,
        expirytime = (lnd_expire) ? 604800000 : (iscrypto === true) ? 25920000000 : 6048000000, // expirydate crypto: 300 days / fiat: 70 days / lightning: 7 days
        isexpired = (status == "expired" || (now() - localtime) >= expirytime && (lnd_expire || status == "new" || insufficient === true)),
        expiredclass = (isexpired === true) ? " expired" : "",
        localtimeobject = new Date(localtime),
        requestdateformatted = fulldateformat(localtimeobject, "en-us"),
        timeformat = "<span class='rq_month'>" + localtimeobject.toLocaleString("en-us", {
            "month": "short"
        }) + "</span> <span class='rq_day'>" + localtimeobject.getDate() + "</span>",
        ptsformatted = fulldateformatmarkup(new Date(paymenttimestamp - timezone), "en-us"),
        amount_short_rounded = amountshort(amount, receivedamount, fiatvalue, iscrypto),
        amount_short_span = (insufficient === true) ? " (" + amount_short_rounded + " " + uoa_upper + " short)" : "",
        amount_short_cc_span = (iscrypto === true) ? amount_short_span : "",
        created = (requestdate) ? requestdateformatted : "<strong>unknown</strong>",
        fiatvaluebox = (iscrypto === true || !fiatvalue) ? "" : "<li class='payday pd_fiat'><strong>Fiat value on<span class='pd_fiat'> " + ptsformatted + "</span> :</strong><span class='fiatvalue'> " + fiatvalue_rounded + "</span> " + currencyname + "<div class='show_as amountshort'>" + amount_short_span + "</div></li>",
        paymentdetails = "<li class='payday pd_paydate'><strong>Paid on:</strong><span class='paydate'> " + ptsformatted + "</span></li><li class='receivedamount'><strong>Amount received:</strong><span> " + receivedamount_rounded + "</span> " + payment + "<div class='show_as amountshort'>" + amount_short_cc_span + "</div></li>" + fiatvaluebox,
        requestnamebox = (incoming === true) ? (rqdata) ? "<li><strong>From:</strong> " + requestname + "</li>" : "<li><strong>From: unknown</strong></li>" : "",
        requesttitlebox = (requesttitle) ? "<li><strong>Title:</strong> '<span class='requesttitlebox'>" + requesttitle + "</span>'</li>" : "",
        ismonitoredspan = (ismonitored === false) ? " (unmonitored transaction)" : "",
        timestampbox = (incoming === true) ? "<li><strong>Created:</strong> " + created + "</li><li><strong>First viewed:</strong> " + fulldateformat(new Date(utc), "en-us") + "</li>" :
        (outgoing === true) ? "<li><strong>Request send on:</strong> " + requestdateformatted + "</li>" :
        (local === true) ? "<li><strong>Created:</strong> " + requestdateformatted + "</li>" : "",
        paymenturl = "&address=" + address + rqdataparam + rqmetaparam + "&requestid=" + requestid,
        islabel = $("main #" + payment + " li[data-address='" + address + "']").data("label"),
        requestlabel = (islabel) ? " <span class='requestlabel'>(" + islabel + ")</span>" : "",
        conf_box = (ismonitored === false) ? "<div class='txli_conf' data-conf='0'><span>Unmonitored transaction</span></div>" :
        (conf > 0) ? "<div class='txli_conf'><div class='confbar'></div><span>" + conf + " / " + set_confirmations + " confirmations</span></div>" :
        (conf === 0) ? "<div class='txli_conf' data-conf='0'><div class='confbar'></div><span>Unconfirmed transaction<span></div>" : "",
        view_tx_markup = (lnhash) ? "<li><strong class='show_tx'><span class='icon-power'></span><span class='ref'>View invoice</span></strong></li>" : (txhash) ? "<li><strong class='show_tx'><span class='icon-eye'></span>View on blockchain</strong></li>" : "",
        statustext = (ismonitored === false) ? "" : (status == "new") ? "Waiting for payment" : status,
        src_html = (source) ? "<span class='src_txt'>source: " + source + "</span><span class='icon-wifi-off'></span><span class='icon-connection'></span>" : "",
        iscryptoclass = (iscrypto === true) ? "" : " isfiat",
        archivebutton = (showarchive === true) ? "<div class='icon-folder-open' title='archive request'></div>" : "",
        render_archive = (txhistory && (pending == "no" || archive === true)),
        tl_text = (render_archive === true) ? "Transactions:" : "",
        edit_request = (local === true) ? "<div class='editrequest icon-pencil' title='edit request' data-requestid='" + requestid + "'></div>" : "",
        pid_li = (payment_id) ? "<li><strong>Payment ID:</strong> <span class='select' data-type='payment ID'>" + payment_id + "</span></li>" : "",
        ia_li = (xmr_ia) ? "<li><p class='address'><strong>Integrated Address:</strong> <span class='requestaddress select'>" + xmr_ia + "</span></p></li>" : "",
        ln_emoji = (lnhash) ? " <span class='icon-power'></span>" : "",
        ln_logo = "<img src='img_logos_btc-lnd.png' class='cmc_icon'><img src='img_logos_btc-lnd.png' class='cmc_icon'>",
        cclogo = getcc_icon(cmcid, cpid, erc20) + getcc_icon(cmcid, cpid, erc20),
        cc_logo = (lightning) ? (txhash && !lnhash) ? cclogo : ln_logo : cclogo,
        rc_address_title = (hybrid) ? "Fallback address" : "Receiving Address",
        address_markup = (lightning && (lnhash || hybrid === false)) ? "" : "<li><p class='address'><strong>" + rc_address_title + ":</strong> <span class='requestaddress select'>" + address + "</span>" + requestlabel + "</p></li>",
        new_requestli = $("<li class='rqli " + requesttypeclass + expiredclass + lnclass + "' id='" + requestid + "' data-cmcid='" + cmcid + "' data-status='" + status + "' data-address='" + address + "' data-pending='" + pending + "' data-iscrypto='" + iscrypto + "'>\
			<div class='liwrap iconright'>" + cc_logo +
            "<div class='atext'>\
					<h2>" + requesttitlestring + "</h2>\
					<p class='rq_subject'>" + typeicon + requestnamestring + "</p>\
				</div>\
				<p class='rq_date' title='" + requestdateformatted + "'>" + timeformat + "</p><br/>\
				<div class='pmetastatus' data-count='0'>+ 0</div>\
				<div data-rel='" + paymenturl + "' class='payrequest button" + iscryptoclass + "'>\
					<span class='icon-qrcode'>Pay</span>\
				</div>\
			</div>\
			<div class='moreinfo'>\
				<div class='req_actions'>\
					<div data-rel='" + paymenturl + "' class='icon-qrcode" + iscryptoclass + "'></div>\
					<div class='icon-bin' title='delete'></div>" +
            archivebutton +
            "<div class='icon-undo2' title='unarchive request'></div>\
					<div class='icon-info' title='show info'></div>" + edit_request + "</div>\
				<ul class='metalist'>\
					<li class='cnamemeta'><strong>Currency:</strong> " + payment + ln_emoji + "</li>" +
            requestnamebox +
            requesttitlebox +
            "<li><strong>Amount:</strong> " + amount_rounded + " " + uoa_upper + "</li>\
					<li class='meta_status' data-conf='" + conf + "'><strong>Status:</strong><span class='status'> " + statustext + "</span> " + conf_box + "</li>\
					<li><strong>Type:</strong> " + typetext + ismonitoredspan + "</li>" +
            timestampbox +
            paymentdetails +
            address_markup +
            pid_li +
            ia_li +
            "<li class='receipt'><p><span class='icon-file-pdf' title='View receipt'/>Receipt</p></li>" + view_tx_markup +
            "</ul>\
				<ul class='transactionlist'>\
					<h2>" + tl_text + "</h2>\
				</ul>\
				<div class='api_source'>" + src_html + "</div>\
			</div>\
			<div class='brstatuspanel flex'>\
				<img src='" + c_icons("confirmed") + "'>\
				<h2>Payment " + direction + "</h2>\
			</div>\
			<div class='brmarker'></div>\
			<div class='expired_panel'><h2>Expired</h2></div>\
		</li>");
    new_requestli.data(rd).prependTo(requestlist);
    if (render_archive === true) {
        var transactionlist = requestlist.find("#" + requestid).find(".transactionlist");
        $.each(txhistory, function(dat, val) {
            var txh = val.txhash,
                lnh = (txh && txh.slice(0, 9) == "lightning") ? true : false,
                tx_listitem = append_tx_li(val, false, lnh);
            if (tx_listitem.length > 0) {
                transactionlist.append(tx_listitem.data(val));
            }
        });
    }
}

function receipt() {
    $(document).on("click", ".receipt > p", function() {
        var thisnode = $(this),
            requestli = thisnode.closest(".rqli"),
            rqdat = requestli.data(),
            requestid = rqdat.requestid,
            receipt_url = get_pdf_url(rqdat),
            receipt_title = "bitrequest_receipt_" + requestid + ".pdf",
            ddat = [{
                "div": {
                    "class": "popform"
                },
                "div": {
                    "id": "backupactions",
                    "content": [{
                            "div": {
                                "id": "share_receipt",
                                "class": "util_icon icon-share2",
                                "attr": {
                                    "data-receiptdat": receipt_url,
                                    "data-requestid": requestid
                                }
                            }
                        },
                        {
                            "a": {
                                "id": "dl_receipt",
                                "class": "util_icon icon-download",
                                "attr": {
                                    "href": receipt_url,
                                    "target": "_blank",
                                    "title": "Download " + receipt_title,
                                    "download": receipt_title
                                }
                            }
                        },
                        {
                            "a": {
                                "id": "receipt_link",
                                "class": "customtrigger",
                                "attr": {
                                    "href": receipt_url,
                                    "target": "_blank",
                                    "download": receipt_title
                                },
                                "content": "OK"
                            }
                        },
                        {
                            "div": {
                                "id": "canceldialog",
                                "class": "customtrigger",
                                "content": "CANCEL"
                            }
                        }
                    ]
                }
            }],
            content = template_dialog({
                "id": "invoiceformbox",
                "icon": "icon-file-pdf",
                "title": "bitrequest_receipt_" + requestid + ".pdf",
                "elements": ddat
            });
        popdialog(content, "triggersubmit");
    })
}

function get_pdf_url(rqdat) {
    var requestid = rqdat.requestid,
        currencyname = rqdat.currencyname,
        requestname = rqdat.requestname,
        requesttitle = rqdat.requesttitle,
        ismonitored = rqdat.monitored,
        status = rqdat.status,
        statustext = (status == "new") ? "Waiting for payment" : status,
        txhash = rqdat.txhash,
        lnhash = (txhash && txhash.slice(0, 9) == "lightning") ? true : false,
        lightning = rqdat.lightning,
        hybrid = (lightning && lightning.hybrid === true),
        paymenttimestamp = rqdat.paymenttimestamp,
        ptsformatted = fulldateformat(new Date(paymenttimestamp - timezone), "en-us"),
        amount = rqdat.amount,
        fiatvalue = rqdat.fiatvalue,
        receivedamount = rqdat.receivedamount,
        receivedamount_rounded = trimdecimals(receivedamount, 6),
        fiatvalue_rounded = trimdecimals(fiatvalue, 2),
        requesttype = rqdat.requesttype,
        incoming = (requesttype == "incoming"),
        outgoing = (requesttype == "outgoing"),
        local = (requesttype == "local"),
        checkout = (requesttype == "checkout"),
        typetext = (incoming === true) ? (checkout) ? "online purchase" : "incoming" : (local === true) ? "point of sale" : "outgoing",
        iscrypto = rqdat.iscrypto,
        deter = (iscrypto === true) ? 6 : 2,
        amount_rounded = trimdecimals(amount, deter),
        uoa = rqdat.uoa,
        uoa_upper = uoa.toUpperCase(),
        requestdate = rqdat.requestdate,
        timestamp = rqdat.timestamp,
        utc = timestamp - timezone,
        localtime = (requestdate) ? requestdate - timezone : utc,
        localtimeobject = new Date(localtime),
        requestdateformatted = fulldateformat(localtimeobject, "en-us"),
        created = (requestdate) ? requestdateformatted : "unknown",
        utc_format = fulldateformat(new Date(utc)),
        invd = {},
        lnd_string = (lnhash) ? " (lightning)" : "";
    invd["Request ID"] = requestid;
    invd.Currency = rqdat.payment + lnd_string;
    if (exists(requestname)) {
        invd.From = requestname;
    }
    if (exists(requesttitle)) {
        invd.Title = "'" + requesttitle + "'";
    }
    invd.Amount = amount_rounded + " " + uoa_upper,
        invd.Status = statustext,
        invd.Type = typetext;
    if (incoming === true) {
        invd["Created"] = created;
        invd["First viewed"] = utc_format;
    }
    invd.Address = rqdat.address;
    if (status === "paid") {
        invd["Paid on"] = ptsformatted,
            invd["Amount received"] = receivedamount_rounded + " " + rqdat.payment;
        if (iscrypto === true) {} else {
            invd["Fiat value on " + ptsformatted] = fiatvalue_rounded + " " + currencyname;
        }
    }
    if (exists(txhash)) {
        invd["TxID"] = txhash;
    }
    var set_proxy = d_proxy();
    return set_proxy + "proxy/v1/receipt/?data=" + btoa(JSON.stringify(invd));
}

function download_receipt() {
    $(document).on("click", "#dl_receipt", function(e) {
        var thisbttn = $(this),
            href = thisbttn.attr("href"),
            title = thisbttn.attr("title"),
            result = confirm(title + "?");
        if (result === false) {
            e.preventDefault();
            return false;
        }
    })
}

function share_receipt() {
    $(document).on("click", "#share_receipt", function() {
        var thisbttn = $(this),
            href = thisbttn.attr("data-receiptdat"),
            requestid = thisbttn.attr("data-requestid"),
            filename = "bitrequest_receipt_" + requestid + ".pdf",
            result = confirm("Share " + filename + "?");
        if (result === true) {
            loader(true);
            loadertext("generate receipt");
            var accountname = $("#accountsettings").data("selected"),
                sharedtitle = "bitrequest_receipt_" + requestid + ".pdf";
            shorten_url(sharedtitle, href, fetch_aws("img_receipt_icon.png"), true);
            closeloader();
        }
    })
}

function lnd_lookup_invoice(proxy, imp, hash, nid, pid, pw) {
    var p_arr = lnurl_deform(proxy),
        proxy_host = p_arr.url,
        pk = (pw) ? pw : p_arr.k,
        proxy_url = proxy_host + "proxy/v1/ln/api/",
        postdata = {
            "method": "POST",
            "cache": false,
            "timeout": 5000,
            "url": proxy_url,
            "data": {
                "fn": "ln-invoice-decode",
                "imp": imp,
                "hash": hash,
                "nid": nid,
                "callback": "no",
                "id": pid,
                "x-api": pk
            }
        };
    loader(true);
    loadertext("connecting to " + lnurl_encode("lnurl", proxy_host));
    $.ajax(postdata).done(function(e) {
        if (e) {
            var error = e.error;
            if (error) {
                popdialog("<h2 class='icon-blocked'>" + error.message + "</h2>", "canceldialog");
                closeloader();
                return;
            }
            var ddat = [{
                    "div": {
                        "class": "popform",
                        "content": [{
                                "div": {
                                    "class": "invoice_body",
                                    "content": "<pre>" + syntaxHighlight(e) + "</pre><div class='inv_pb'><img src='" + c_icons(imp) + "' class='lnd_icon' title='" + imp + "'/> Powered by " + imp + "</div>"
                                }
                            },
                            {
                                "input": {
                                    "class": "submit",
                                    "attr": {
                                        "type": "submit",
                                        "value": "OK"
                                    }
                                }
                            }
                        ]
                    }
                }],
                content = template_dialog({
                    "id": "invoiceformbox",
                    "icon": "icon-power",
                    "title": "Invoice",
                    "elements": ddat
                });
            popdialog(content, "canceldialog");
            closeloader();
            return
        }
        notify("Unable to fetch invoice");
        closeloader();
    }).fail(function(jqXHR, textStatus, errorThrown) {
        notify("Unable to fetch invoice");
        closeloader();
    });
}

function amountshort(amount, receivedamount, fiatvalue, iscrypto) {
    var amount_recieved = (iscrypto === true) ? receivedamount : fiatvalue,
        amount_short = amount - amount_recieved;
    return (iscrypto === true) ? trimdecimals(amount_short, 5) : trimdecimals(amount_short, 2);
}

function editrequest() {
    $(document).on("click", ".editrequest", function() {
        var thisnode = $(this),
            thisrequestid = thisnode.attr("data-requestid"),
            requestlist = $("#" + thisrequestid),
            requesttitle = requestlist.data("requesttitle"),
            requesttitle_input = (requesttitle) ? requesttitle : "",
            formheader = (requesttitle) ? "Edit" : "Enter",
            content = "\
			<div class='formbox' id='edit_request_formbox'>\
				<h2 class='icon-pencil'>" + formheader + " description</h2>\
				<div class='popnotify'></div>\
				<div class='popform'>\
					<input type='text' value='" + requesttitle_input + "' placeholder='description'/>\
					<input type='submit' class='submit' value='OK' data-requestid='" + thisrequestid + "'/>\
				</div>\
			</div>";
        popdialog(content, "triggersubmit");
    })
}

function submit_request_description() {
    $(document).on("click", "#edit_request_formbox input.submit", function(e) {
        var thisnode = $(this),
            this_requestid = thisnode.attr("data-requestid"),
            this_requesttitle = thisnode.prev("input").val(),
            requesttitle_val = (this_requesttitle) ? this_requesttitle : "empty";
        if (this_requesttitle) {
            updaterequest({
                "requestid": this_requestid,
                "requesttitle": requesttitle_val
            }, true);
            canceldialog();
            notify("Request saved");
            return
        }
        popnotify("error", "Description is a required field");
    })
}

// ** Store data in localstorage **

//update used cryptocurrencies
function savecurrencies(add) {
    var currenciespush = [];
    $("#usedcurrencies li").each(function(i) {
        currenciespush.push($(this).data());
    });
    localStorage.setItem("bitrequest_currencies", JSON.stringify(currenciespush));
    updatechanges("currencies", add);
}

//update addresses in localstorage
function saveaddresses(currency, add) {
    var pobox = get_addresslist(currency),
        addresses = pobox.find("li");
    if (addresses.length) {
        var addressboxpush = [];
        addresses.each(function(i) {
            addressboxpush.push($(this).data());
        });
        localStorage.setItem("bitrequest_cc_" + currency, JSON.stringify(addressboxpush));
    } else {
        localStorage.removeItem("bitrequest_cc_" + currency);
        localStorage.removeItem("bitrequest_" + currency + "_settings");
    }
    updatechanges("addresses", add);
}

//update requests
function saverequests() {
    var requestpush = [];
    $("ul#requestlist > li").each(function() {
        requestpush.push($(this).data());
    });
    localStorage.setItem("bitrequest_requests", JSON.stringify(requestpush));
    updatechanges("requests", true);
}

//update archive
function savearchive() {
    var requestpush = [];
    $("ul#archivelist > li").each(function() {
        requestpush.push($(this).data());
    });
    localStorage.setItem("bitrequest_archive", JSON.stringify(requestpush));
}

//update settings
function savesettings(nit) {
    var settingsspush = [];
    $("ul#appsettings > li.render").each(function() {
        settingsspush.push($(this).data());
    });
    localStorage.setItem("bitrequest_settings", JSON.stringify(settingsspush));
    updatechanges("settings", true, nit);
}

function save_cc_settings(currency, add) {
    var settingbox = {};
    $("#" + currency + "_settings ul.cc_settinglist > li").each(function() {
        var thisnode = $(this);
        settingbox[thisnode.attr("data-id")] = thisnode.data();
    });
    localStorage.setItem("bitrequest_" + currency + "_settings", JSON.stringify(settingbox));
    updatechanges("currencysettings", add);
}

function updatechanges(key, add, nit) {
    if (add === true) {
        var cc = changes[key],
            cc_correct = (cc) ? cc : 0;
        changes[key] = cc_correct + 1;
        savechangesstats();
    }
    if (!nit === true) {
        updateappdata();
    }
}

function resetchanges() {
    changes = {};
    savechangesstats();
    body.removeClass("haschanges");
    $("#alert > span").text("0").attr("title", "You have 0 changes in your app");
}

function savechangesstats() {
    localStorage.setItem("bitrequest_changes", JSON.stringify(changes));
    change_alert();
}

// render changes
function renderchanges() {
    var changescache = localStorage.getItem("bitrequest_changes");
    if (changescache) {
        changes = JSON.parse(changescache);
        setTimeout(function() { // wait for Googleauth to load
            change_alert();
        }, 700);
        return
    }
    changes = {};
}

function change_alert() {
    var total_changes = get_total_changes();
    if (total_changes > 0) {
        $("#alert > span").text(total_changes).attr("title", "You have " + total_changes + " changes in your app");
        setTimeout(function() {
            body.addClass("haschanges");
        }, 2500);
    }
}

function get_total_changes() {
    var totalchanges = 0;
    $.each(changes, function(key, value) {
        var thisval = (value) ? value : 0;
        totalchanges += parseInt(thisval);
    });
    return totalchanges;
}

// ** Get_app **

function detectapp() {
    if (inframe === true || is_android_app === true || is_ios_app === true) {
        return
    }
    var show_dialog = sessionStorage.getItem("bitrequest_appstore_dialog") || localStorage.getItem("bitrequest_appstore_dialog");
    if (show_dialog) {
        return
    }
    if (supportsTouch === true) {
        var device = getdevicetype();
        if (device == "Android") {
            //getapp("android");
            return
        }
        if (device == "iPhone" || device == "iPad" || device == "Macintosh") {
            getapp("apple");
        }
    }
}

function getapp(type) {
    var app_panel = $("#app_panel");
    app_panel.html("");
    var android = (type == "android"),
        button = (android === true) ? fetch_aws("img_button-playstore.png") : fetch_aws("img_button-appstore.png"),
        url = (android === true) ? "https://play.google.com/store/apps/details?id=" + androidpackagename + "&pcampaignid=fdl_long&url=" + approot + encodeURIComponent(w_loc.search) : "https://apps.apple.com/app/id1484815377?mt=8",
        panelcontent = "<h2>Download the app</h2>\
			<a href='" + url + "' class='exit store_bttn'><img src='" + button + "'></a><br/>\
			<div id='not_now'>Not now</div>";
    app_panel.html(panelcontent);
    setTimeout(function() {
        body.addClass("getapp");
    }, 1500);
}

function close_app_panel() {
    $(document).on("click", "#not_now", function() {
        body.removeClass("getapp");
        setTimeout(function() {
            $("#app_panel").html("");
        }, 800);
        sessionStorage.setItem("bitrequest_appstore_dialog", true);
        if (getdevicetype() == "Android") {
            localStorage.setItem("bitrequest_appstore_dialog", true);
        }
    });
}

function platform_icon(platform) {
    return (platform == "playstore") ? fetch_aws("img_button-playstore.png") :
        (platform == "appstore") ? fetch_aws("img_button-appstore.png") :
        fetch_aws("img_button-desktop_app.png");
}

function fetch_aws(filename, bckt) {
    var bucket = (bckt) ? bckt : aws_bucket;
    return bucket + filename;
}

// HTML rendering

function render_html(dat) {
    var result = "";
    $.each(dat, function(i, value) {
        $.each(value, function(key, val) {
            var id = (val.id) ? " id='" + val.id + "'" : "",
                clas = (val.class) ? " class='" + val.class + "'" : "",
                attr = (val.attr) ? render_attributes(val.attr) : "",
                cval = val.content,
                content = (cval) ? (typeof cval == "object") ? render_html(cval) : cval : "",
                close = (val.close) ? "/>" : ">" + content + "</" + key + ">";
            result += "<" + key + id + clas + attr + close;
        });
    });
    return result;
}

function render_attributes(attr) {
    var attributes = "";
    $.each(attr, function(key, value) {
        attributes += " " + key + "='" + value + "'";
    });
    return attributes;
}

// HTML templates

function template_dialog(ddat) {
    var validated_class = (ddat.validated) ? " validated" : "",
        dialog_object = [{
            "div": {
                "id": ddat.id,
                "class": "formbox",
                "content": [{
                        "h2": {
                            "class": ddat.icon,
                            "content": ddat.title
                        }
                    },
                    {
                        "div": {
                            "class": "popnotify"
                        }
                    },
                    {
                        "div": {
                            "class": "pfwrap",
                            "content": render_html(ddat.elements)
                        }
                    }
                ]
            }
        }]
    return render_html(dialog_object);
}

// Query helpers

function exists(val) {
    if (val === undefined || val === null || !val.length) {
        return false;
    }
    return true;
}

function now() {
    return Date.now();
}

function shake(node) {
    node.addClass("shake");
    setTimeout(function() {
        node.removeClass("shake");
        vibrate();
    }, 200);
}

function get_setting(setting, dat) {
    return $("#" + setting).data(dat);
}

function set_setting(setting, keypairs, title) {
    var set_node = $("#" + setting);
    set_node.data(keypairs);
    if (title) {
        set_node.find("p").text(title);
    }
}

function get_requestli(datakey, dataval) {
    return $("#requestlist li.rqli").filter(function() {
        return $(this).data(datakey) == dataval;
    })
}

function get_addresslist(currency) {
    return $("main #" + currency + " .content ul.pobox[data-currency='" + currency + "']");
}

function filter_addressli(currency, datakey, dataval) {
    var addressli = get_addresslist(currency).children("li");
    return addressli.filter(function() {
        return $(this).data(datakey) == dataval;
    })
}

function filter_all_addressli(datakey, dataval) {
    var all_addressli = $(".adli");
    return all_addressli.filter(function() {
        return $(this).data(datakey) == dataval;
    })
}

function filter_list(list, datakey, dataval) {
    return list.filter(function() {
        return $(this).data(datakey) == dataval;
    })
}

function dom_to_array(dom, dat) {
    return dom.map(function() {
        return $(this).data(dat);
    }).get();
}

function get_latest_index(alist) {
    var index = dom_to_array(alist, "derive_index");
    return Math.max.apply(Math, index);
}

function check_currency(currency) {
    var addresscount = filter_addressli(currency, "checked", true).length;
    if (addresscount > 0) {
        currency_check(currency);
        return
    }
    currency_uncheck(currency);
}

function currency_check(currency) {
    var currencylistitem = $("#currencylist > li[data-currency='" + currency + "']"),
        parentcheckbox = $("#usedcurrencies li[data-currency='" + currency + "']");
    currencylistitem.removeClass("hide");
    parentcheckbox.attr("data-checked", "true").data("checked", true);
    savecurrencies(false);
}

function currency_uncheck(currency) {
    var currencylistitem = $("#currencylist > li[data-currency='" + currency + "']"),
        parentcheckbox = $("#usedcurrencies li[data-currency='" + currency + "']");
    currencylistitem.addClass("hide");
    parentcheckbox.attr("data-checked", "false").data("checked", false);
    savecurrencies(false);
}

function d_proxy() {
    return $("#api_proxy").data("selected");
}

function get_vk(address) {
    var ad_li = filter_addressli("monero", "address", address),
        ad_dat = (ad_li.length) ? ad_li.data() : {},
        ad_vk = ad_dat.vk;
    if (ad_vk && ad_vk != "") {
        return vk_obj(ad_vk);
    }
    return false;
}

function vk_obj(vk) {
    if (vk.length === 64) {
        return {
            "account": false,
            "vk": vk
        }
    }
    if (vk.length === 159) {
        return {
            "account": vk.slice(0, 95),
            "vk": vk.slice(95)
        }
    }
    return false;
}

function share_vk() {
    var vkshare = cs_dat("monero", "Share viewkey").selected;
    if (vkshare === true) {
        return true;
    }
    return false;
}

function gk() {
    var k = io.k;
    if (k) {
        var pk = JSON.parse(atob(k));
        if (pk.if_id == "" || pk.ad_id == "" || pk.ga_id == "" || pk.bc_id == "") {
            fk();
            return
        }
        init_keys(k, true);
        return
    }
    fk();
}

function fk() {
    api_proxy({
        "proxy": true,
        "custom": "gk",
        "api_url": true
    }).done(function(e) {
        var ko = e.k;
        if (ko) {
            init_keys(ko, false);
        }
    }).fail(function() {
        //init_keys();
    });
}

function init_keys(ko, set) { // set required keys
    var k = JSON.parse(atob(ko));
    to = k;
    var if_id = k.if_id,
        if_set = (if_id != ""),
        ga_set = (k.ga_id != ""),
        api_data = $("#apikeys").data(),
        if_saved_key = api_data.infura,
        if_set_key = (if_set === true) ? if_id : null,
        if_key = (if_saved_key) ? if_saved_key : if_set_key;
    if (ga_set === true) {
        setTimeout(function() {
            gapi_load(is_ios_app);
        }, 1000);
    }
    io.k = ko;
    if (set === false) {
        localStorage.setItem("bitrequest_init", JSON.stringify(io));
    }
}

function check_rr() {
    var ls_recentrequests = localStorage.getItem("bitrequest_recent_requests");
    if (ls_recentrequests) {
        var lsrr_arr = JSON.parse(ls_recentrequests);
        if ($.isEmptyObject(lsrr_arr)) {
            toggle_rr(false);
            return
        }
        toggle_rr(true);
        return
    }
    toggle_rr(false);
}

function toggle_rr(bool) {
    if (bool) {
        html.addClass("show_rr");
        var hist_bttn = $("#request_history");
        hist_bttn.addClass("load");
        setTimeout(function() {
            hist_bttn.removeClass("load");
        }, 500);
        return
    }
    html.removeClass("show_rr");
}

// add serviceworker
function add_serviceworker() {
    if ("serviceWorker" in navigator) {
        if (!navigator.serviceWorker.controller) {
            navigator.serviceWorker.register(approot + "serviceworker.js", {
                    "scope": "./"
                })
                .then(function(reg) {
                    // console.log("Service worker has been registered for scope: " + reg.scope);
                });
        }
    }
}