NEWSBLUR.ReaderFeedchooser = function (options) {
    options = options || {};
    var defaults = {
        'width': options.premium_only || options.chooser_only ? 600 : 900,
        'height': 750,
        'premium_only': false,
        'chooser_only': false,
        'onOpen': _.bind(function () {
            this.resize_modal();
        }, this),
        'onClose': _.bind(function () {
            if (!this.flags['has_saved'] && !this.model.flags['has_chosen_feeds']) {
                NEWSBLUR.reader.show_feed_chooser_button();
            }
            dialog.data.hide().empty().remove();
            dialog.container.hide().empty().remove();
            dialog.overlay.fadeOut(200, function () {
                dialog.overlay.empty().remove();
                $.modal.close(callback);
            });
            $('.NB-modal-holder').empty().remove();
        }, this)
    };

    this.options = $.extend({}, defaults, options);
    this.model = NEWSBLUR.assets;
    this.runner();
};

NEWSBLUR.ReaderFeedchooser.prototype = new NEWSBLUR.Modal;
NEWSBLUR.ReaderFeedchooser.prototype.constructor = NEWSBLUR.ReaderFeedchooser;

_.extend(NEWSBLUR.ReaderFeedchooser.prototype, {

    runner: function () {
        var self = this;
        this.start = new Date();

        // Define format_number method early
        this.format_number = function (num) {
            return parseInt(num).toLocaleString();
        };

        // Determine current plan from globals
        this.current_plan = 'free';
        if (NEWSBLUR.Globals.is_pro) {
            this.current_plan = 'pro';
        } else if (NEWSBLUR.Globals.is_archive_plus) {
            this.current_plan = 'archive_plus';
        } else if (NEWSBLUR.Globals.is_archive) {
            this.current_plan = 'archive';
        } else if (NEWSBLUR.Globals.is_premium_plus) {
            this.current_plan = 'premium_plus';
        } else if (NEWSBLUR.Globals.is_premium) {
            this.current_plan = 'premium';
        }

        // Set feed limits based on user type
        if (NEWSBLUR.Globals.is_pro) {
            // Pro users have a sliding scale
            var current_feeds = _.size(NEWSBLUR.assets.feeds);
            this.MAX_FEEDS = 1000 + Math.max(0, Math.floor((current_feeds - 1000) / 1000) + 1) * 1000;
        } else if (NEWSBLUR.Globals.is_archive_plus) {
            this.MAX_FEEDS = 5000;
        } else if (NEWSBLUR.Globals.is_archive) {
            this.MAX_FEEDS = 1000;
        } else if (NEWSBLUR.Globals.is_premium_plus) {
            this.MAX_FEEDS = 5000;
        } else if (NEWSBLUR.Globals.is_premium) {
            this.MAX_FEEDS = 1000;
        } else {
            this.MAX_FEEDS = 64;
        }

        NEWSBLUR.assets.feeds.each(function (feed) {
            self.add_feed_to_decline(feed);
        });

        this.make_modal();
        this.make_paypal_button();

        if (!this.options.premium_only) {
            this.initial_load_feeds();
        }

        // Initialize pro slider if applicable
        this.setup_pro_slider();

        // Initialize segmented controls based on current plan
        this.initialize_segmented_controls();

        _.defer(_.bind(function () { this.update_counts(true); }, this));

        this.flags = {
            'has_saved': false
        };
        this.open_modal();

        this.$modal.bind('mousedown', $.rescope(this.handle_mousedown, this));
        this.$modal.bind('change', $.rescope(this.handle_change, this));
    },

    make_modal: function () {
        var self = this;
        var $creditcards = $.make('div', { className: 'NB-creditcards' }, [
            $.make('img', { src: NEWSBLUR.Globals.MEDIA_URL + "/img/reader/cc_stripe.svg" }),
            $.make('img', { src: NEWSBLUR.Globals.MEDIA_URL + "/img/reader/cc_visa.svg" }),
            $.make('img', { src: NEWSBLUR.Globals.MEDIA_URL + "/img/reader/cc_mastercard.svg" }),
            $.make('img', { src: NEWSBLUR.Globals.MEDIA_URL + "/img/reader/cc_amex.svg" }),
            $.make('img', { src: NEWSBLUR.Globals.MEDIA_URL + "/img/reader/cc_discover.svg" })
        ]);
        this.$modal = $.make('div', { className: 'NB-modal-feedchooser NB-modal ' + (this.options.premium_only ? "NB-feedchooser-premium" : this.options.chooser_only ? "NB-feedchooser-chooser-only" : "NB-feedchooser-standard") }, [
            // $.make('h2', { className: 'NB-modal-title' }, 'Choose Your '+this.MAX_FEEDS),
            (!this.options.chooser_only && $.make('div', { className: 'NB-feedchooser-type NB-right' }, [
                (!this.options.premium_only && $.make('div', { className: 'NB-feedchooser-porpoise' }, 'OR')),
                $.make('div', { className: 'NB-feedchooser-premium-plan' }, [
                    $.make('div', { className: 'NB-feedchooser-info' }, [
                        $.make('div', { className: 'NB-feedchooser-info-type' }, [
                            'Premium Subscription',
                            $.make('span', { className: 'NB-feedchooser-subtitle-type-price NB-feedchooser-premium-price' }, '$36/year'),
                        ])
                    ]),
                    $.make('ul', { className: 'NB-feedchooser-premium-bullets' }, [
                        $.make('li', { className: 'NB-0 NB-feedchooser-premium-toggle-container' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            $.make('div', { className: 'NB-feedchooser-premium-toggle-content' }, [
                                $.make('div', { className: 'NB-feedchooser-premium-toggle-text' }, [
                                    $.make('b', [
                                        'Follow up to ',
                                        $.make('span', { className: 'NB-feedchooser-premium-feed-count' }, '1,000'),
                                        ' sites'
                                    ]),
                                    $.make('div', { className: 'NB-feedchooser-premium-current-usage' }, [
                                        'Currently following ',
                                        $.make('span', { className: 'NB-feedchooser-premium-current-feeds' }, this.format_number(_.size(NEWSBLUR.assets.feeds))),
                                        ' sites'
                                    ])
                                ]),
                                $.make('div', { className: 'NB-feedchooser-premium-toggle-wrapper' }, [
                                    $.make('ul', { className: 'segmented-control NB-feedchooser-premium-multiplier' }, [
                                        $.make('li', { className: 'NB-feedchooser-premium-1x NB-active', 'data-multiplier': '1' }, 'Premium'),
                                        $.make('li', { className: 'NB-feedchooser-premium-2x', 'data-multiplier': '2' }, 'Premium Plus')
                                    ])
                                ])
                            ])
                        ]),
                        $.make('li', { className: 'NB-2' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Sites updated up to 5x more often'
                        ]),
                        $.make('li', { className: 'NB-3' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'River of News (reading by folder)'
                        ]),
                        $.make('li', { className: 'NB-4' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Search sites and folders'
                        ]),
                        $.make('li', { className: 'NB-5' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Save stories with searchable tags'
                        ]),
                        $.make('li', { className: 'NB-6' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Privacy options for your blurblog'
                        ]),
                        $.make('li', { className: 'NB-7' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Custom RSS feeds for saved stories'
                        ]),
                        $.make('li', { className: 'NB-8' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Text view conveniently extracts the story'
                        ]),
                        $.make('li', { className: 'NB-9' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Peek into related stories and sites'
                        ]),
                        $.make('li', { className: 'NB-10' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'You feed Lyric, NewsBlur\'s hungry hound, for ',
                            $.make('span', { className: 'NB-feedchooser-hungry-dog' }, '6 days'),
                            $.make('img', { className: 'NB-feedchooser-premium-poor-hungry-dog', src: NEWSBLUR.Globals.MEDIA_URL + '/img/reader/lyric.jpg' })
                        ])
                    ]),
                    $.make('div', { className: 'NB-payment-providers' }, [
                        (!NEWSBLUR.Globals.is_premium && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                $.make('div', {
                                    className: "NB-provider-button-premium NB-modal-submit-button NB-modal-submit-green"
                                }, [
                                    "Upgrade to Premium"
                                ]),
                                $creditcards.clone()
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                $.make('span', { className: "NB-provider-text" }, "subscribe with "),
                                $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "premium" }, "")
                            ])
                        ])),
                        (NEWSBLUR.Globals.is_premium && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', {
                                className: "NB-feedchooser-premium-already"
                            }, [
                                $.make('div', { className: 'NB-feedchooser-premium-already-icon' }),
                                $.make('div', { className: 'NB-feedchooser-premium-already-message' }, [
                                    (NEWSBLUR.Globals.is_archive && "Your premium archive subscription includes everything above"),
                                    (!NEWSBLUR.Globals.is_archive && !NEWSBLUR.Globals.is_pro && "Your premium subscription is active")
                                ])
                            ])
                        ])),
                        (NEWSBLUR.Globals.is_premium && !NEWSBLUR.Globals.premium_renewal && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                $.make('div', {
                                    className: "NB-provider-button-premium NB-modal-submit-button NB-modal-submit-green"
                                }, [
                                    (NEWSBLUR.Globals.is_archive || NEWSBLUR.Globals.is_pro) && "Switch plans to a premium subscription",
                                    !(NEWSBLUR.Globals.is_archive || NEWSBLUR.Globals.is_pro) && "Restart your premium subscription",
                                ])
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "premium" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-premium NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards.clone())
                            ])
                        ])),
                        (NEWSBLUR.Globals.is_premium && !NEWSBLUR.Globals.is_archive && !NEWSBLUR.Globals.is_pro && NEWSBLUR.Globals.premium_renewal && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                $.make('div', {
                                    className: "NB-provider-button-change NB-modal-submit-button NB-modal-submit-grey"
                                }, [
                                    "Change billing details"
                                ])
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "premium" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-premium NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards.clone())
                            ])
                        ]))
                    ])
                ]),
                $.make('div', { className: 'NB-feedchooser-premium-plan' }, [
                    $.make('div', { className: 'NB-feedchooser-info' }, [
                        $.make('div', { className: 'NB-feedchooser-info-type' }, [
                            'Premium Archive Subscription',
                            $.make('span', { className: 'NB-feedchooser-subtitle-type-price NB-feedchooser-archive-price' }, '$99/year'),
                        ])
                    ]),
                    $.make('ul', { className: 'NB-feedchooser-premium-bullets NB-feedchooser-premium-archive-bullets' }, [
                        $.make('li', { className: 'NB-0 NB-feedchooser-archive-toggle-container' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            $.make('div', { className: 'NB-feedchooser-archive-toggle-content' }, [
                                $.make('div', { className: 'NB-feedchooser-archive-toggle-text' }, [
                                    $.make('b', [
                                        'Follow and fully archive up to ',
                                        $.make('span', { className: 'NB-feedchooser-archive-feed-count' }, '1,000'),
                                        ' sites'
                                    ]),
                                    $.make('div', { className: 'NB-feedchooser-archive-current-usage' }, [
                                        'Currently following ',
                                        $.make('span', { className: 'NB-feedchooser-archive-current-feeds' }, this.format_number(_.size(NEWSBLUR.assets.feeds))),
                                        ' sites'
                                    ])
                                ]),
                                $.make('div', { className: 'NB-feedchooser-archive-toggle-wrapper' }, [
                                    $.make('ul', { className: 'segmented-control NB-feedchooser-archive-multiplier' }, [
                                        $.make('li', { className: 'NB-feedchooser-archive-1x NB-active', 'data-multiplier': '1' }, 'Premium Archive'),
                                        $.make('li', { className: 'NB-feedchooser-archive-2x', 'data-multiplier': '2' }, 'Premium Archive Plus')
                                    ])
                                ])
                            ])
                        ]),
                        $.make('li', { className: 'NB-1' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Everything in the premium subscription, of course'
                        ]),
                        $.make('li', { className: 'NB-2' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Choose when stories are automatically marked as read'
                        ]),
                        $.make('li', { className: 'NB-3' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Every story from every site is archived and searchable forever'
                        ]),
                        $.make('li', { className: 'NB-4' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Feeds that support paging are back-filled in for a complete archive'
                        ]),
                        $.make('li', { className: 'NB-5' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Discover related stories and sites across every story in your archive'
                        ]),
                        $.make('li', { className: 'NB-6' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Export trained stories from folders as RSS feeds'
                        ]),
                        $.make('li', { className: 'NB-7' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Stories can stay unread forever'
                        ])
                    ]),
                    $.make('div', { className: 'NB-payment-providers' }, [
                        (!NEWSBLUR.Globals.is_archive && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [

                            $.make('div', { className: 'NB-provider-main' }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $creditcards.clone()),
                                $.make('div', {
                                    className: "NB-provider-button-archive NB-modal-submit-button NB-modal-submit-green"
                                }, [
                                    "Upgrade to Premium Archive",
                                    (NEWSBLUR.Globals.active_provider == "paypal" && " with PayPal")
                                ]),
                                this.make_premium_archive_prorate_message(),
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "archive" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-archive NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards)
                            ])
                            // $.make('div', { className: "NB-provider-note" }, "Note: Due to the intricacies of PayPal integration, you will be charged the full amount. If you switch to credit card, you will only be charged a prorated amount.")
                        ])),
                        (NEWSBLUR.Globals.is_archive && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', {
                                className: "NB-feedchooser-premium-already"
                            }, [
                                $.make('div', { className: 'NB-feedchooser-premium-already-icon' }),
                                $.make('div', { className: 'NB-feedchooser-premium-already-message' }, [
                                    "Your premium archive subscription is active"
                                ])
                            ])
                        ])),
                        (NEWSBLUR.Globals.is_archive && !NEWSBLUR.Globals.premium_renewal && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                $.make('div', {
                                    className: "NB-provider-button-archive NB-modal-submit-button NB-modal-submit-green"
                                }, [
                                    !NEWSBLUR.Globals.is_archive && "Switch plans to a premium archive subscription",
                                    NEWSBLUR.Globals.is_archive && "Restart your premium archive subscription",
                                ])
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "archive" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-archive NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards.clone())
                            ])
                        ])),
                        (NEWSBLUR.Globals.is_archive && !NEWSBLUR.Globals.is_pro && NEWSBLUR.Globals.premium_renewal && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                $.make('div', {
                                    className: "NB-provider-button-change NB-modal-submit-button NB-modal-submit-grey"
                                }, [
                                    "Change billing details"
                                ])
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "archive" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-archive NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards.clone())
                            ])
                        ]))
                    ])
                ]),
                $.make('div', { className: 'NB-feedchooser-premium-plan' }, [
                    $.make('div', { className: 'NB-feedchooser-info' }, [
                        $.make('div', { className: 'NB-feedchooser-info-type' }, [
                            'Premium Pro Subscription',
                            $.make('span', { className: 'NB-feedchooser-subtitle-type-price NB-feedchooser-pro-price' }, '$' + this.calculate_pro_price_for_feeds(_.size(NEWSBLUR.assets.feeds)) + '/month'),
                        ])
                    ]),
                    $.make('ul', { className: 'NB-feedchooser-premium-bullets NB-feedchooser-premium-pro-bullets' }, [
                        $.make('li', { className: 'NB-0 NB-feedchooser-pro-slider-container' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            $.make('div', { className: 'NB-feedchooser-pro-slider-content' }, [
                                $.make('div', { className: 'NB-feedchooser-pro-slider-header' }, [
                                    $.make('b', 'Follow up to '),
                                    $.make('span', { className: 'NB-feedchooser-pro-feed-count' }, '1,000'),
                                    $.make('b', ' sites in real-time'),
                                    $.make('div', { className: 'NB-feedchooser-pro-current-usage' }, [
                                        'Currently following ',
                                        $.make('span', { className: 'NB-feedchooser-pro-current-feeds' }, this.format_number(_.size(NEWSBLUR.assets.feeds))),
                                        ' sites'
                                    ])
                                ]),
                                $.make('div', { className: 'NB-feedchooser-pro-slider-wrapper' }, [
                                    $.make('div', { className: 'NB-feedchooser-pro-slider-container' }, [
                                        $.make('input', {
                                            type: 'range',
                                            className: 'NB-feedchooser-pro-slider',
                                            min: '1000',
                                            max: '10000',
                                            step: '1000',
                                            value: '1000'
                                        }),
                                        $.make('div', { className: 'NB-feedchooser-pro-slider-labels' }, [
                                            $.make('span', { className: 'NB-feedchooser-pro-slider-min' }, '1,000'),
                                            $.make('span', { className: 'NB-feedchooser-pro-slider-max' }, '10,000')
                                        ])
                                    ]),
                                    $.make('div', { className: 'NB-feedchooser-pro-slider-price' }, '$29/month')
                                ]),
                                $.make('div', { className: 'NB-feedchooser-pro-usage-note' }, 'Pay only for what you use — billing automatically adjusts as you add or remove feeds')
                            ])
                        ]),
                        $.make('li', { className: 'NB-1' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'Everything in the premium archive subscription'
                        ]),
                        $.make('li', { className: 'NB-2' }, [
                            $.make('div', { className: 'NB-feedchooser-premium-bullet-image' }),
                            'All of your feeds are fetched every 5 minutes'
                        ])
                    ]),
                    $.make('div', { className: 'NB-payment-providers' }, [
                        (!NEWSBLUR.Globals.is_pro && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $creditcards.clone()),
                                $.make('div', {
                                    className: "NB-provider-button-pro NB-modal-submit-button NB-modal-submit-green"
                                }, [
                                    "Upgrade to ",
                                    $.make('br'),
                                    " Premium Pro",
                                    (NEWSBLUR.Globals.active_provider == "paypal" && " with PayPal")
                                ]),
                                this.make_premium_pro_prorate_message(),
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "pro" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-pro NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards)
                            ])
                            // $.make('div', { className: "NB-provider-note" }, "Note: Due to the intricacies of PayPal integration, you will be charged the full amount. If you switch to credit card, you will only be charged a prorated amount.")
                        ])),
                        (NEWSBLUR.Globals.is_pro && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', {
                                className: "NB-feedchooser-premium-already"
                            }, [
                                $.make('div', { className: 'NB-feedchooser-premium-already-icon' }),
                                $.make('div', { className: 'NB-feedchooser-premium-already-message' }, [
                                    "Your premium pro subscription is active"
                                ])
                            ])
                        ])),
                        (NEWSBLUR.Globals.is_pro && !NEWSBLUR.Globals.premium_renewal && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                $.make('div', {
                                    className: "NB-provider-button-pro NB-modal-submit-button NB-modal-submit-green"
                                }, [
                                    !NEWSBLUR.Globals.is_pro && "Switch plans to a premium pro subscription",
                                    NEWSBLUR.Globals.is_pro && "Restart your premium pro subscription",
                                ])
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "pro" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-pro NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards.clone())
                            ])
                        ])),
                        (NEWSBLUR.Globals.is_pro && !NEWSBLUR.Globals.is_pro && NEWSBLUR.Globals.premium_renewal && $.make("div", { className: "NB-feedchooser-premium-upgrade" }, [
                            $.make('div', { className: 'NB-provider-main' }, [
                                $.make('div', {
                                    className: "NB-provider-button-change NB-modal-submit-button NB-modal-submit-grey"
                                }, [
                                    "Change billing details"
                                ])
                            ]),
                            $.make('div', { className: 'NB-feedchooser-or-bar' }),
                            $.make("div", { className: "NB-provider-alternate" }, [
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make('span', { className: "NB-provider-text" }, "subscribe with ")),
                                (NEWSBLUR.Globals.active_provider != "paypal" && $.make("div", { className: "NB-splash-link NB-paypal-button", "data-plan": "pro" }, "")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $.make("div", { className: "NB-stripe-button-switch-pro NB-modal-submit-button NB-modal-submit-green" }, "Switch to Credit Card")),
                                (NEWSBLUR.Globals.active_provider == "paypal" && $creditcards.clone())
                            ])
                        ]))
                    ])
                ])
            ])),
            (!this.options.premium_only && $.make('div', { className: 'NB-feedchooser-type NB-feedchooser-left' }, [
                (!NEWSBLUR.Globals.is_premium && $.make('div', { className: 'NB-feedchooser-info' }, [
                    $.make('div', { className: 'NB-feedchooser-info-type' }, [
                        'Standard Account',
                        $.make('span', { className: 'NB-feedchooser-subtitle-type-price' }, 'Free'),
                    ]),
                    $.make('h2', { className: 'NB-modal-subtitle' }, [
                        $.make('b', [
                            'You can follow up to ' + this.MAX_FEEDS + ' sites.'
                        ]),
                        $.make('br'),
                        'You can always change these.'
                    ]),
                    $.make('div', { className: 'NB-feedchooser-info-counts' }),
                    $.make('div', { className: 'NB-feedchooser-info-sort' }, 'Auto-Selected By Popularity'),
                    $.make('div', { className: 'NB-feedchooser-info-reset NB-splash-link' }, 'Reset to popular sites')
                ])),
                (NEWSBLUR.Globals.is_premium && !this.options.chooser_only && $.make('div', { className: 'NB-feedchooser-info' }, [
                    $.make('div', { className: 'NB-feedchooser-info-type' }, [
                        $.make('span', { className: 'NB-feedchooser-info-type-name' },
                            NEWSBLUR.Globals.is_pro ? 'PREMIUM PRO ACCOUNT' :
                                NEWSBLUR.Globals.is_archive ? 'PREMIUM ARCHIVE ACCOUNT' :
                                    'PREMIUM ACCOUNT'
                        ),
                        $.make('span', { className: 'NB-feedchooser-subtitle-type-price' },
                            NEWSBLUR.Globals.is_pro ? '$29/MONTH' :
                                NEWSBLUR.Globals.is_archive ? '$99/YEAR' :
                                    '$36/YEAR'),
                    ]),
                    $.make('h2', { className: 'NB-modal-subtitle' }, [
                        $.make('b', [
                            'You can follow up to ' + this.format_number(this.MAX_FEEDS) + ' sites.'
                        ]),
                        $.make('br'),
                        NEWSBLUR.Globals.is_pro ?
                            'Adjust the slider to add more feeds.' :
                            'Upgrade to add more feeds to your account.'
                    ]),
                    $.make('div', { className: 'NB-feedchooser-info-counts' })
                ])),
                (this.options.chooser_only && $.make('div', { className: 'NB-feedchooser-info' }, [
                    $.make('h2', { className: 'NB-modal-title' }, [
                        $.make('div', { className: 'NB-icon' }),
                        'Mute sites',
                        $.make('div', { className: 'NB-icon-dropdown' })
                    ]),
                    $.make('div', { className: 'NB-feedchooser-info-reset NB-splash-link' }, 'Turn every site on'),
                    $.make('div', { className: 'NB-feedchooser-info-counts' })
                ])),
                $.make('div', { id: 'NB-feedchooser-feeds', className: 'NB-feedchooser-feeds-container' }, [
                    this.make_feeds()
                ]),
                $.make('form', { className: 'NB-feedchooser-form' }, [
                    $.make('div', { className: 'NB-modal-submit' }, [
                        // $.make('div', { className: 'NB-modal-submit-or' }, 'or'),
                        $.make('input', { type: 'submit', disabled: 'true', className: 'NB-disabled NB-modal-submit-button NB-modal-submit-save NB-modal-submit-green', value: 'Check what you like above...' }),
                        $.make('input', { type: 'submit', className: 'NB-modal-submit-add NB-modal-submit-button NB-modal-submit-green', value: 'First, add sites' })
                    ])
                ]).bind('submit', function (e) {
                    e.preventDefault();
                    return false;
                })
            ]))
        ]);
    },

    make_premium_archive_prorate_message: function () {
        if (!_.contains(["paypal", "stripe"], NEWSBLUR.Globals.active_provider))
            return;
        return $.make('div', { className: "NB-premium-prorate-message" }, "Your existing subscription will be prorated");
    },

    make_premium_pro_prorate_message: function () {
        if (!_.contains(["paypal", "stripe"], NEWSBLUR.Globals.active_provider))
            return;
        return $.make('div', { className: "NB-premium-prorate-message" }, "Your existing subscription will be prorated");
    },

    make_paypal_button: function () {
        jQuery.ajax({
            type: "GET",
            url: NEWSBLUR.URLs.paypal_checkout_js,
            dataType: "script",
            cache: true
        }).done(_.bind(function () {
            $(".NB-paypal-button").each(function () {
                var $button = $(this);
                var plan = $button.data('plan');
                var plan_id;
                if (NEWSBLUR.Globals.debug) {
                    if (plan == 'premium') plan_id = "P-4RV31836YD8080909MHZROJY";
                    else if (plan == 'archive') plan_id = "P-2EG40290653242115MHZROQQ";
                    else if (plan == 'pro') plan_id = "P-1AE0908250058421JM565SVY";
                } else {
                    if (plan == 'premium') plan_id = "P-48R22630SD810553FMHZONIY";
                    else if (plan == 'archive') plan_id = "P-5JM46230U31841226MHZOMZY";
                    else if (plan == 'pro') plan_id = "P-1AE0908250058421JM565SVY";
                }
                var random_id = 'paypal-' + Math.round(Math.random() * 100000);
                $button.attr('id', random_id);
                paypal.Buttons({
                    fundingSource: paypal.FUNDING.PAYPAL,
                    style: {
                        shape: 'rect',
                        color: 'silver',
                        layout: 'horizontal',
                        label: 'paypal',
                    },

                    createSubscription: function (data, actions) {
                        return actions.subscription.create({
                            'plan_id': plan_id,
                            'application_context': {
                                'shipping_preference': 'NO_SHIPPING',
                                'user_action': 'SUBSCRIBE_NOW'
                            },
                            'custom_id': NEWSBLUR.Globals.user_id
                        });
                    },

                    onApprove: function (data, actions) {
                        // Full available details
                        console.log('Paypal approve result', data.subscriptionID, JSON.stringify(data, null, 2));
                        if (plan == "archive") {
                            actions.redirect(NEWSBLUR.URLs.paypal_archive_return);
                        } else if (plan == "pro") {
                            actions.redirect(NEWSBLUR.URLs.paypal_pro_return);
                        } else {
                            actions.redirect(NEWSBLUR.URLs.paypal_return);
                        }
                    },

                    onError: function (err) {
                        console.log(err);
                    }
                }).render('#' + random_id);
            });
        }, this));
    },

    make_google_button: function () {
        var checkout = '<script type="text/javascript" src="https://images-na.ssl-images-amazon.com/images/G/01/cba/js/widget/widget.js"></script><form method=POST action="https://payments.amazon.com/checkout/A215TOHXICT770"><input type="hidden" name="order-input" value="type:cba-signed-order/sha1-hmac/1;order:PD94bWwgdmVyc2lvbj0nMS4wJyBlbmNvZGluZz0nVVRGLTgnPz48T3JkZXIgeG1sbnM9J2h0dHA6Ly9wYXltZW50cy5hbWF6b24uY29tL2NoZWNrb3V0LzIwMDgtMTEtMzAvJz48Q2FydD48SXRlbXM+PEl0ZW0+PE1lcmNoYW50SWQ+QTIxNVRPSFhJQ1Q3NzA8L01lcmNoYW50SWQ+PFRpdGxlPk5ld3NCbHVyIFByZW1pdW0gLSAxIFllYXI8L1RpdGxlPjxEZXNjcmlwdGlvbj5UaGFuayB5b3UsIHRoYW5rIHlvdSwgdGhhbmsgeW91ITwvRGVzY3JpcHRpb24+PFByaWNlPjxBbW91bnQ+MTI8L0Ftb3VudD48Q3VycmVuY3lDb2RlPlVTRDwvQ3VycmVuY3lDb2RlPjwvUHJpY2U+PFF1YW50aXR5PjE8L1F1YW50aXR5PjxGdWxmaWxsbWVudE5ldHdvcms+TUVSQ0hBTlQ8L0Z1bGZpbGxtZW50TmV0d29yaz48L0l0ZW0+PC9JdGVtcz48L0NhcnQ+PC9PcmRlcj4=;signature:Zfg83JluKTIhItevtaGpspjdbfQ="><input alt="Checkout with Amazon Payments" src="https://payments.amazon.com/gp/cba/button?ie=UTF8&color=tan&background=white&cartOwnerId=A215TOHXICT770&size=large" type="image"></form>';
        var $checkout = $(checkout);
        return $checkout;
    },

    make_feeds: function () {
        var feeds = this.model.feeds;
        this.feed_count = _.unique(NEWSBLUR.assets.folders.feed_ids_in_folder({ include_inactive: true })).length;

        this.feedlist = new NEWSBLUR.Views.FeedList({
            feed_chooser: true,
            sorting: this.options.sorting
        }).make_feeds();
        var $feeds = this.feedlist.$el;
        if (this.options.resize) {
            $feeds.css({ 'max-height': this.options.resize });
        }
        if ($feeds.data('sortable')) $feeds.data('sortable').disable();

        // Expand collapsed folders
        $('.NB-folder-collapsed', $feeds).css({
            'display': 'block',
            'opacity': 1
        }).removeClass('NB-folder-collapsed');

        // Pretend unfetched feeds are fine
        $('.NB-feed-unfetched', $feeds).removeClass('NB-feed-unfetched');

        // Make sure all folders are visible
        $('.NB-folder.NB-hidden', $feeds).removeClass('NB-hidden');

        NEWSBLUR.assets.folders.sort();

        NEWSBLUR.assets.feeds.off('change:highlighted')
            .on('change:highlighted', _.bind(this.change_selection, this));


        return $feeds;
    },

    resize_modal: function (previous_height) {
        var $left = $('.NB-feedchooser-left', this.$modal);
        var $feedsContainer = $('#NB-feedchooser-feeds', this.$modal);
        var $modalParent = this.$modal.parent();
        var modalParentHeight = $modalParent.height();

        // Calculate space taken by other elements in the left column
        var headerHeight = $('.NB-feedchooser-info', $left).outerHeight(true) || 0;
        var formHeight = $('.NB-feedchooser-form', $left).outerHeight(true) || 0;
        var modalPadding = parseInt(this.$modal.css('padding-top')) + parseInt(this.$modal.css('padding-bottom')) || 0;
        var containerMargins = parseInt($feedsContainer.css('margin-top')) + parseInt($feedsContainer.css('margin-bottom')) || 0;
        var padding = 60; // Additional buffer for spacing

        // Calculate available height for feeds container
        var availableHeight = modalParentHeight - headerHeight - formHeight - modalPadding - containerMargins - padding;

        console.log('Resize modal - modalParentHeight:', modalParentHeight, 'headerHeight:', headerHeight,
            'formHeight:', formHeight, 'availableHeight:', availableHeight);

        // Set max-height on the feeds container
        if (availableHeight > 200) {
            $feedsContainer.css({ 'max-height': availableHeight + 'px' });
        }
    },

    add_feed_to_decline: function (feed, update) {
        feed.highlight_in_all_folders(false, true, { silent: !update });

        if (update) {
            this.update_counts(true);
        }
    },

    add_feed_to_approve: function (feed, update) {
        feed.highlight_in_all_folders(true, false, { silent: false });

        if (update) {
            this.update_counts(true);
        }
    },

    change_selection: function (update) {
        this.update_counts();
    },

    update_counts: function (autoselected) {
        if (this.options.premium_only) return;

        var $count = $('.NB-feedchooser-info-counts');
        var approved = this.feedlist.folder_view.highlighted_count();
        var $submit = $('.NB-modal-submit-save', this.$modal);
        var difference = approved - this.MAX_FEEDS;
        var muted = this.feed_count - approved;

        $count.text(approved + '/' + Inflector.commas(this.feed_count));

        if (NEWSBLUR.Globals.is_premium) {
            $submit.removeClass('NB-disabled').removeClass('NB-modal-submit-grey').attr('disabled', false);
            if (muted == 0) {
                $submit.val('Enable all ' + Inflector.pluralize('site', this.feed_count, true));
            } else {
                $submit.val('Mute ' + Inflector.pluralize('site', muted, true));
            }
            $count.toggleClass('NB-full', muted == 0);
        } else {
            $count.toggleClass('NB-full', approved == this.MAX_FEEDS);
            $count.toggleClass('NB-error', approved > this.MAX_FEEDS);

            if (!autoselected) {
                this.hide_autoselected_label();
            }
            if (approved > this.MAX_FEEDS) {
                $submit.addClass('NB-disabled').addClass('NB-modal-submit-grey').attr('disabled', true).val('Too many sites! Deselect ' + (
                    difference == 1 ?
                        '1 site...' :
                        difference + ' sites...'
                ));
            } else {
                $submit.removeClass('NB-disabled').removeClass('NB-modal-submit-grey').attr('disabled', false).val('Turn on these ' + approved + ' sites, please');
            }
        }
    },

    initial_load_feeds: function (reset) {
        var start = new Date();
        var self = this;
        var feeds = this.model.get_feeds();
        var approved = 0; // this.feedlist.folder_view.highlighted_count();

        if (!feeds.size()) {
            _.defer(_.bind(function () {
                var $info = $('.NB-feedchooser-info', this.$modal);
                $('.NB-feedchooser-info-counts', $info).hide();
                $('.NB-feedchooser-info-sort', $info).hide();
                $('.NB-feedchooser-info-reset', $info).hide();
                $('#NB-feedchooser-feeds').hide();
                $('.NB-modal-submit-save').hide();
                $('.NB-modal-submit-add').show();
            }, this));
            return;
        }

        if (reset) {
            feeds.each(function (feed) {
                self.add_feed_to_decline(feed, true);
            });
        }

        var active_feeds = feeds.any(function (feed) { return feed.get('active'); });
        if (!active_feeds || reset) {
            // Get feed subscribers bottom cut-off
            var min_subscribers = _.last(
                _.first(
                    _.map(feeds.select(function (f) { return !f.has_exception; }), function (f) { return f.get('subs'); }).sort(function (a, b) {
                        return b - a;
                    }),
                    this.MAX_FEEDS
                )
            );

            // Decline everything
            var approve_feeds = [];
            feeds.each(function (feed) {
                // self.add_feed_to_decline(feed);

                if (feed.get('subs') >= min_subscribers) {
                    approve_feeds.push(feed);
                }
            });

            // Approve feeds in subs
            _.each(approve_feeds, function (feed) {
                if (feed.get('subs') > min_subscribers &&
                    approved < self.MAX_FEEDS &&
                    !feed.get('has_exception')) {
                    approved++;
                    self.add_feed_to_approve(feed, false);
                }
            });
            _.each(approve_feeds, function (feed) {
                if (feed.get('subs') == min_subscribers &&
                    approved < self.MAX_FEEDS) {
                    approved++;
                    self.add_feed_to_approve(feed, false);
                }
            });

            this.show_autoselected_label();
        } else {
            // Get active feeds
            var active_feeds = feeds.select(function (feed) {
                return feed.get('active');
            });

            // Approve or decline
            _.each(active_feeds, function (feed) {
                self.add_feed_to_approve(feed, false);
            });

            this.hide_autoselected_label();
        }
        this.update_counts(true);
    },

    show_autoselected_label: function () {
        // console.log('show_autoselected_label');
        $('.NB-feedchooser-info-sort', this.$modal).stop();
        $('.NB-feedchooser-info-reset', this.$modal).stop().fadeOut(500, _.bind(function () {
            // console.log('show_autoselected_label done');
            $('.NB-feedchooser-info-reset', this.$modal).hide();
            $('.NB-feedchooser-info-sort', this.$modal).fadeIn(500);
        }, this));
    },

    hide_autoselected_label: function () {
        // console.log('hide_autoselected_label');
        $('.NB-feedchooser-info-reset', this.$modal).stop();
        $('.NB-feedchooser-info-sort', this.$modal).stop().fadeOut(500, _.bind(function () {
            // console.log('hide_autoselected_label done');
            $('.NB-feedchooser-info-sort', this.$modal).hide();
            $('.NB-feedchooser-info-reset', this.$modal).fadeIn(500);
        }, this));
    },

    save: function () {
        var self = this;
        var $submit = $('.NB-modal-submit-save', this.$modal);
        $submit.addClass('NB-disabled').removeClass('NB-modal-submit-green').val('Saving...');
        var approve_list = _.pluck(NEWSBLUR.assets.feeds.filter(function (feed) {
            return feed.get('highlighted');
        }), 'id');

        console.log(["Saving", approve_list]);

        NEWSBLUR.reader.flags['reloading_feeds'] = true;
        this.model.save_feed_chooser(approve_list, function () {
            self.flags['has_saved'] = true;
            NEWSBLUR.reader.flags['reloading_feeds'] = false;
            NEWSBLUR.reader.hide_feed_chooser_button();
            NEWSBLUR.assets.load_feeds();
            $.modal.close();
        });
    },

    close_and_add: function () {
        $.modal.close(function () {
            NEWSBLUR.add_feed = new NEWSBLUR.ReaderAddFeed();
        });
    },

    open_stripe_form: function () {
        var renew = (this.options.renew ? "&renew=true" : "");
        window.location.href = "/profile/stripe_form?plan=" + this.plan + renew;
    },

    open_stripe_checkout: function (plan, $button) {
        if ($button.hasClass('NB-disabled')) return;
        $button.attr('disabled', 'disabled');
        $button.removeClass('NB-modal-submit-red');
        $button.text("Loading checkout...");
        $button.addClass('NB-disabled').addClass('NB-modal-submit-grey').attr('disabled', true);

        $.redirectPost("/profile/switch_stripe_subscription", { "plan": plan });
    },

    open_paypal_checkout: function (plan, $button) {
        if ($button.hasClass('NB-disabled')) return;
        $button.attr('disabled', 'disabled');
        $button.removeClass('NB-modal-submit-red');
        $button.text("Loading PayPal...");
        $button.addClass('NB-disabled').addClass('NB-modal-submit-grey').attr('disabled', true);

        $.redirectPost("/profile/switch_paypal_subscription", { "plan": plan });
    },

    // ===========
    // = Actions =
    // ===========

    handle_mousedown: function (elem, e) {
        var self = this;
        var $target = $(e.target);

        // Premium multiplier toggle
        if ($target.hasClass('NB-feedchooser-premium-1x') || $target.hasClass('NB-feedchooser-premium-2x')) {
            e.preventDefault();
            $('.NB-feedchooser-premium-multiplier li', this.$modal).removeClass('NB-active');
            $target.addClass('NB-active');
            var multiplier = parseInt($target.attr('data-multiplier'));
            this.update_premium_pricing(multiplier);
            return;
        }

        // Archive multiplier toggle
        if ($target.hasClass('NB-feedchooser-archive-1x') || $target.hasClass('NB-feedchooser-archive-2x')) {
            e.preventDefault();
            $('.NB-feedchooser-archive-multiplier li', this.$modal).removeClass('NB-active');
            $target.addClass('NB-active');
            var multiplier = parseInt($target.attr('data-multiplier'));
            this.update_archive_pricing(multiplier);
            return;
        }

        $.targetIs(e, { tagSelector: '.NB-modal-submit-save' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.save();
        }, this));

        $.targetIs(e, { tagSelector: '.NB-modal-submit-add' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.close_and_add();
        }, this));

        $.targetIs(e, { tagSelector: '.NB-stripe-button-switch-premium' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.open_stripe_checkout('premium', $t);
        }, this));

        $.targetIs(e, { tagSelector: '.NB-stripe-button-switch-archive' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.open_stripe_checkout('archive', $t);
        }, this));

        $.targetIs(e, { tagSelector: '.NB-stripe-button-switch-pro' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.open_stripe_checkout('pro', $t);
        }, this));

        $.targetIs(e, { tagSelector: '.NB-paypal-button-archive' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.open_paypal_checkout('archive', $t);
        }, this));

        $.targetIs(e, { tagSelector: '.NB-paypal-button-pro' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.open_paypal_checkout('pro', $t);
        }, this));

        $.targetIs(e, { tagSelector: '.NB-provider-button-change' }, _.bind(function ($t, $p) {
            e.preventDefault();
            if (NEWSBLUR.Globals.active_provider == "stripe") {
                this.open_stripe_checkout('change_stripe', $t);
            } else if (NEWSBLUR.Globals.active_provider == "paypal") {
                this.open_paypal_checkout('change_paypal', $t);
            }
        }, this));

        $.targetIs(e, { tagSelector: '.NB-provider-button-premium' }, _.bind(function ($t, $p) {
            e.preventDefault();
            if (!NEWSBLUR.Globals.active_provider || NEWSBLUR.Globals.active_provider == "stripe") {
                this.open_stripe_checkout('premium', $t);
            } else if (NEWSBLUR.Globals.active_provider == "paypal") {
                this.open_paypal_checkout('premium', $t);
            }
        }, this));

        $.targetIs(e, { tagSelector: '.NB-provider-button-archive' }, _.bind(function ($t, $p) {
            e.preventDefault();
            if (!NEWSBLUR.Globals.active_provider || NEWSBLUR.Globals.active_provider == "stripe") {
                this.open_stripe_checkout('archive', $t);
            } else if (NEWSBLUR.Globals.active_provider == "paypal") {
                this.open_paypal_checkout('archive', $t);
            }
        }, this));

        $.targetIs(e, { tagSelector: '.NB-provider-button-pro' }, _.bind(function ($t, $p) {
            e.preventDefault();
            if (!NEWSBLUR.Globals.active_provider || NEWSBLUR.Globals.active_provider == "stripe") {
                this.open_stripe_checkout('pro', $t);
            } else if (NEWSBLUR.Globals.active_provider == "paypal") {
                this.open_paypal_checkout('pro', $t);
            }
        }, this));

        $.targetIs(e, { tagSelector: '.NB-feedchooser-info-reset' }, _.bind(function ($t, $p) {
            e.preventDefault();
            this.initial_load_feeds(true);
        }, this));
    },

    handle_change: function (elem, e) {
        var $target = $(e.target);

        if ($target.hasClass('NB-feedchooser-pro-slider')) {
            var current_feeds = _.size(NEWSBLUR.assets.feeds);
            this.update_pro_pricing_with_current($target.val(), current_feeds);
        }
    },


    update_pro_pricing: function (feed_count) {
        // Linear pricing: $29 for 1000 feeds to $299 for 10000 feeds
        // That's $270 for 9000 feeds = $30 per 1000 feeds
        var base_price = 29;
        var price_per_thousand = 30;

        var thousands = feed_count / 1000;
        var monthly_price = base_price + (thousands - 1) * price_per_thousand;

        // Update feed count display
        $('.NB-feedchooser-pro-feed-count', this.$modal).text(this.format_number(feed_count));

        // Update slider price display
        $('.NB-feedchooser-pro-slider-price', this.$modal).text('$' + monthly_price + '/month');

        // Note: We don't update .NB-feedchooser-pro-price (header) as it should show current actual price
    },

    update_pro_pricing_with_current: function (slider_value, current_feeds) {
        // Calculate price for slider position
        var slider_price = this.calculate_pro_price_for_feeds(slider_value);

        // Update displays
        $('.NB-feedchooser-pro-feed-count', this.$modal).text(this.format_number(slider_value));
        $('.NB-feedchooser-pro-slider-price', this.$modal).text('$' + slider_price + '/month');
    },

    calculate_pro_price_for_feeds: function (feed_count) {
        // Linear pricing: $29 for 1000 feeds to $299 for 10000 feeds
        // That's $270 for 9000 feeds = $30 per 1000 feeds
        var base_price = 29;
        var price_per_thousand = 30;

        // Round up to nearest 1000 for pricing
        var thousands = Math.ceil(feed_count / 1000);
        var monthly_price = base_price + (thousands - 1) * price_per_thousand;
        return monthly_price;
    },


    update_premium_pricing: function (multiplier) {
        var base_price = 36;
        var standard_feeds = 1000;
        var plus_feeds = 5000;
        var current_feeds = _.size(NEWSBLUR.assets.feeds);

        var price = base_price * multiplier;
        var feeds = multiplier === 1 ? standard_feeds : plus_feeds;

        // Update feed count display
        $('.NB-feedchooser-premium-feed-count', this.$modal).text(this.format_number(feeds));

        // Update price display
        $('.NB-feedchooser-premium-price', this.$modal).text('$' + price + '/year');

        // Update current feeds display and check if over limit
        var $currentFeeds = $('.NB-feedchooser-premium-current-feeds', this.$modal);
        if (current_feeds > feeds) {
            $currentFeeds.addClass('NB-over-limit');
        } else {
            $currentFeeds.removeClass('NB-over-limit');
        }

        // Update header title
        var headerTitle = multiplier === 1 ? 'Premium Subscription' : 'Premium Plus Subscription';
        var $premiumHeader = this.$modal.find('.NB-feedchooser-premium-plan').first().find('.NB-feedchooser-info-type').first();
        $premiumHeader.contents().filter(function () {
            return this.nodeType === 3; // Text node
        }).first().replaceWith(headerTitle);

        // Update switch plans button text  
        var targetPlan = multiplier === 1 ? 'premium' : 'premium_plus';
        var planName = multiplier === 1 ? "premium subscription" : "premium plus subscription";

        // Find the premium button in the premium plan section
        var $premiumSection = this.$modal.find('.NB-feedchooser-premium-plan').first();
        var $button = $premiumSection.find('.NB-provider-button-premium');

        if ($button.length) {
            var currentText = $button.text().trim();
            var isCurrentPlan = (this.current_plan === targetPlan);

            // Update based on user status
            if (!NEWSBLUR.Globals.is_premium) {
                // Free users always see "Upgrade"
                var upgradeName = multiplier === 1 ? "Premium" : "Premium Plus";
                $button.text('Upgrade to ' + upgradeName);
            } else if (isCurrentPlan) {
                // Same plan = Restart
                $button.text('Restart your ' + planName);
            } else {
                // Different plan = Switch
                $button.text('Switch plans to a ' + planName);
            }
        }
    },

    update_archive_pricing: function (multiplier) {
        var base_price = 99;
        var standard_feeds = 1000;
        var plus_feeds = 5000;
        var current_feeds = _.size(NEWSBLUR.assets.feeds);

        var price = base_price * multiplier;
        var feeds = multiplier === 1 ? standard_feeds : plus_feeds;

        // Update feed count display
        $('.NB-feedchooser-archive-feed-count', this.$modal).text(this.format_number(feeds));

        // Update price display
        $('.NB-feedchooser-archive-price', this.$modal).text('$' + price + '/year');

        // Update current feeds display and check if over limit
        var $currentFeeds = $('.NB-feedchooser-archive-current-feeds', this.$modal);
        if (current_feeds > feeds) {
            $currentFeeds.addClass('NB-over-limit');
        } else {
            $currentFeeds.removeClass('NB-over-limit');
        }

        // Update header title
        var headerTitle = multiplier === 1 ? 'Premium Archive Subscription' : 'Premium Archive Plus';
        var $archiveHeader = this.$modal.find('.NB-feedchooser-premium-archive-bullets').closest('.NB-feedchooser-premium-plan').find('.NB-feedchooser-info-type').first();
        $archiveHeader.contents().filter(function () {
            return this.nodeType === 3; // Text node
        }).first().replaceWith(headerTitle);

        // Update switch plans button text
        var targetPlan = multiplier === 1 ? 'archive' : 'archive_plus';
        var planName = multiplier === 1 ? "premium archive subscription" : "premium archive plus subscription";
        var upgradeName = multiplier === 1 ? "Premium Archive" : "Premium Archive Plus";

        // Find the archive button in the archive plan section
        var $archiveSection = this.$modal.find('.NB-feedchooser-premium-archive-bullets').closest('.NB-feedchooser-premium-plan');
        var $button = $archiveSection.find('.NB-provider-button-archive');

        if ($button.length) {
            var currentText = $button.text().trim();
            var isCurrentPlan = (this.current_plan === targetPlan);

            // Update based on user status
            if (!NEWSBLUR.Globals.is_archive) {
                // Non-archive users see "Upgrade" or "Switch"
                if (!NEWSBLUR.Globals.is_premium) {
                    $button.text('Upgrade to ' + upgradeName);
                } else {
                    $button.text('Switch plans to a ' + planName);
                }
            } else if (isCurrentPlan) {
                // Same plan = Restart
                $button.text('Restart your ' + planName);
            } else {
                // Different plan = Switch
                $button.text('Switch plans to a ' + planName);
            }
        }
    },

    setup_pro_slider: function () {
        var self = this;
        var $slider = $('.NB-feedchooser-pro-slider', this.$modal);

        if ($slider.length) {
            // Set initial value based on current feeds
            var current_feeds = _.size(NEWSBLUR.assets.feeds);
            var slider_value = 1000;

            if (current_feeds > 1000) {
                // Round up to nearest 1000
                slider_value = Math.ceil(current_feeds / 1000) * 1000;
                slider_value = Math.min(slider_value, 10000); // Cap at max
            }

            $slider.val(slider_value);
            this.update_pro_pricing_with_current(slider_value, current_feeds);

            // Add input event for real-time updates
            $slider.on('input', function () {
                self.update_pro_pricing_with_current($(this).val(), current_feeds);
            });
        }
    },

    initialize_segmented_controls: function () {
        var self = this;
        var current_feeds = _.size(NEWSBLUR.assets.feeds);

        // Initialize premium segmented control
        if ($('.NB-feedchooser-premium-multiplier', this.$modal).length) {
            // Auto-select Plus if user has over 1000 feeds, unless they're already on standard premium
            if (this.current_plan === 'premium_plus' || (current_feeds > 1000 && this.current_plan !== 'premium')) {
                $('.NB-feedchooser-premium-1x', this.$modal).removeClass('NB-active');
                $('.NB-feedchooser-premium-2x', this.$modal).addClass('NB-active');
                this.update_premium_pricing(2);
            } else {
                this.update_premium_pricing(1);
            }
        }

        // Initialize archive segmented control
        if ($('.NB-feedchooser-archive-multiplier', this.$modal).length) {
            // Auto-select Plus if user has over 1000 feeds, unless they're already on standard archive
            if (this.current_plan === 'archive_plus' || (current_feeds > 1000 && this.current_plan !== 'archive')) {
                $('.NB-feedchooser-archive-1x', this.$modal).removeClass('NB-active');
                $('.NB-feedchooser-archive-2x', this.$modal).addClass('NB-active');
                this.update_archive_pricing(2);
            } else {
                this.update_archive_pricing(1);
            }
        }
    },

    handle_cancel: function () {
        var $cancel = $('.NB-modal-cancel', this.$modal);

        $cancel.click(function (e) {
            e.preventDefault();
            $.modal.close();
        });
    }

});
