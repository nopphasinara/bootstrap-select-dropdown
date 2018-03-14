(function (factory) {
  if(typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(require("jquery"), window, document);
  } else {
    factory(jQuery, window, document);
  }
}(function($, window, document, undefined) {
  // Assign index numbers to each instance of the plugin
  var index = 0;

  // Create the defaults once
  var pluginName = "selectDropdown",
    defaults = {
      // Behaviour
      maxListLength: 4, // Maximum number of <option> text() values to display within the button.
      hideSelect: true, // Hide the select element.
      multiselectStayOpen: true, // Keep dropdown open on interaction for multiselects.
      search: true, // Wrap the dropdown button in an input group with search form controls.
      observeDomMutations: false, // Respect dynamic changes to the select options.
      maxHeight: '300px', // Make the dropdown scrollable if beyond this height. Set as false to disable.

      // Text.
      textNoneSelected: "None selected",
      textMultipleSelected: "Multiple selected",
      textNoResults: "No results",

      // HTML.
      htmlClear: "Clear search",

      // Classes
      classDropdown: "dropdown",
      classBtnClear: "btn btn-outline-secondary",
      classBtnSearch: "btn btn-primary",
      classMenu: "dropdown-menu",
      classItem: "dropdown-item",

    };

  // The actual plugin constructor
  function Plugin ( element, options, index ) {
    this.index = index;
    this.element = element;
    this.settings = $.extend( {}, defaults, options );
    this._defaults = defaults;
    this._name = pluginName;
    this.init();
  }

  // Avoid Plugin.prototype conflicts
  $.extend( Plugin.prototype, {
    init() {
      var _ = this; // Deep reference to this.
      var $el = $( _.element );
      _.prefix = 'bsd' + _.index + '-'; // Prefix for unique labelling.

      // Properties: Data.
      _.data = {};
      _.data.multiselect = false;
      _.data.preventHideDropdown = false;
      var attrMultiple = $el.attr('multiple');
      if ( typeof attrMultiple !== typeof undefined && attrMultiple !== false ) {
        _.data.multiselect = true;
        if ( _.settings.multiselectStayOpen ) {
          _.data.preventHideDropdown = true;
        }
      }
      _.data.status = 'initial';
      _.data.indexes = [];
      _.data.lastSearch = null;
      _.data.resultsChanged = false;
      _.data.hoverItem = $();

      // Properties: IDs.
      _.ids = {};
      _.ids.dropdownContainerId = _.prefix + 'container';
      _.ids.dropdownButtonId = _.prefix + 'button';
      _.ids.searchControlId = _.prefix + 'search';
      _.ids.dropdownItemDeselect = _.prefix + 'deselect';
      _.ids.dropdownItemShowSelected = _.prefix + 'selected';

      // Properties: Selectors.
      _.selectors = {};
      _.selectors.dropdownItemDeselect = 'a#' + _.ids.dropdownItemDeselect;
      _.selectors.dropdownItemShowSelected = 'a#' + _.ids.dropdownItemShowSelected;

      // Properties: Elements.
      _.els = {};
      _.els.button = _.buildButton();
      _.els.buttonClear = _.buildButtonClear();
      _.els.searchControl = _.buildSearchControl();
      _.els.controlDeselect = _.buildDeselectAll();
      _.els.controlSelected = _.buildShowSelected();
      _.els.dropdown = _.buildDropdownMenu();
      _.els.dropdownItemsContainer = _.buildDropdownItemsContainer();
      _.els.dropdownItemNoResults = _.buildDropdownItemNoResults();
      _.els.dropdownItems = _.buildDropdownItems();
      _.els.dropdownOptions = _.els.dropdownItems.filter( function() {
        return _.isOption( $( this ) );
      });

      // Initialise Search.
      if ( _.settings.search ) {
        var haystack = [];
        var options = {
          keys: ['text'],
          id: 'index'
        };
        _.els.dropdownOptions.each( function( index ) {
          haystack[ index ] = {
            index : $( this ).data('index'),
            text : $( this ).text()
          };
        });
        _.els.searchControl.on('keyup', function( e ) {

          // Detect cursor up and down.
          if ( e.which == 13 ) { // Enter.
            _.toggle( _.els.dropdown.find('.hover').first() );
            if ( !_.data.preventHideDropdown ) {
              _.els.button.dropdown('toggle');
            }
            return;
          }
          else if ( e.which == 38 ) { // Up.
            if ( !_.dropdownActive() ) {
              _.els.button.dropdown('toggle');
              _.els.searchControl.focus();
            }
            _.hoverUp();
            return;
          }
          else if ( e.which == 40 ) { // Down.
            if ( !_.dropdownActive() ) {
              _.els.button.dropdown('toggle');
              _.els.searchControl.focus();
            }
            _.hoverDown();
            return;
          }

          var s = $(this).val();
          var results = null;
          if ( $.trim( s ) == '' ) {
            _.refresh();
            if ( _.data.lastSearch !== null ) {
              _.data.resultsChanged = true;
              _.data.lastSearch = null;
            }
            return;
          } else {
            var fuse = new Fuse( haystack, options );
            results = fuse.search( $(this).val() );
          }
          _.data.resultsChanged = true;
          if ( results ) {
            if (
              typeof _.data.lastSearch !== null &&
              _.arraysEqual( results, _.data.lastSearch )
            ) {
              _.data.resultsChanged = false;
            }

          } else {
            _.refresh();
            return;
          }
          if ( _.data.resultsChanged ) {
            _.setHover( results[0] );
            _.hide( results );
            _.reorder( results );
            _.resetScroll();
          }
          _.data.lastSearch = results;
        });
      }

      // Handle cut and paste.
      _.els.searchControl.bind({
          paste (){
            $(this).trigger('keydown');
          },
          cut (){
            $(this).trigger('keydown');
          }
      });

      // Build.
      _.setButtonText();
      var $dropdown = _.buildDropdown();
      $dropdown
        .append( _.els.dropdown );
      _.els.dropdownItemsContainer
        .append( _.els.dropdownItems );
      if ( _.data.multiselect ) {
        _.els.dropdown
          .append( _.els.controlDeselect )
          .append( _.els.controlSelected );
      }
      _.els.dropdown
        .append( _.els.dropdownItemsContainer );
      $el.after( $dropdown );
      if ( _.settings.hideSelect ) {
        $el.hide();
      }
      _.setHover();

      // Assign click handler: Select item.
      _.els.dropdownOptions.on('click', function( event ){
        event.preventDefault();
        if ( _.data.multiselect && _.settings.multiselectStayOpen ) {
          $dropdown.one('hide.bs.dropdown', function ( event ) {
            event.preventDefault();
          });
        }
        _.toggle( $(this) );
      });

      // Assign click handler: Deselect all.
      _.els.controlDeselect.on('click', function( event ){
        event.preventDefault();
        $dropdown.one('hide.bs.dropdown', function ( event ) {
          event.preventDefault();
        });
        if ( !$(this).hasClass('disabled') ) {
          _.deselectAll();
        }
      });

      // Assign click handler: Show selected.
      _.els.controlSelected.on('click', function( event ){
        event.preventDefault();
        $dropdown.one('hide.bs.dropdown', function ( event ) {
          event.preventDefault();
        });
        if ( !$(this).hasClass('disabled') ) {
          _.sortSelected();
        }
      });

      // Assign click handler: Clear search.
      _.els.buttonClear.on('click', function() {
        _.els.searchControl.val('');
        if ( _.dropdownActive() ) {
          $dropdown.one('hide.bs.dropdown', function ( event ) {
            event.preventDefault();
          });
        }
        _.refresh();
      });

      // Assign click handler: No results.
      _.els.dropdownItemNoResults.on('click', function( event ) {
        event.preventDefault();
        $dropdown.one('hide.bs.dropdown', function ( event ) {
          event.preventDefault();
        });
      });

      // On search focus: Toggle dropdown.
      // - Can reliance on setTimeout be removed?
      // - Should we depend on an aria attribute for plugin logic?
      if ( _.settings.search ) {
        _.els.searchControl.on('focusin', function(){
          if ( _.els.button.attr('aria-expanded') == 'false' ) {
            _.els.button.dropdown('toggle');
            setTimeout(function(){
              _.els.searchControl.focus();
            }, 1);
          }
        });
      }

      _.refreshInitialControls();

      // DOM mutation observer
      if ( _.settings.observeDomMutations ) {
        var config = { childList: true, subtree: true };
        var callback = function( mutationsList ) {
          for( var mutation of mutationsList ) {
            if ( mutation.type == 'childList') {
              _.refresh();
            }
          }
        };
        var observer = new MutationObserver( callback );
        observer.observe( $el[0], config );
      }
    },
    buildDropdown() {
      var _ = this;

      var $dropdown = $('<div>', {
        id : _.ids.dropdownContainerId,
        class : _.settings.classDropdown
      });

      if ( _.settings.search ) {

        // Build dropdown.
        $dropdown.append(
          $('<div>', {
            class: 'input-group'
          })
          .append( _.els.searchControl )
          .append(
            $('<div>', {
              class: 'input-group-append'
            })
            .append( _.els.buttonClear )
          )
          .append(
            $('<div>', {
              class: 'input-group-append'
            })
            .append( _.els.button )
          )
        );

        // Move dropdown menu to the right.
        _.els.dropdown.addClass('dropdown-menu-right');
      } else {

        // Build dropdown.
        $dropdown
          .append( _.els.button );
      }

      return $dropdown;
    },
    buildButton() {
      var _ = this;
      return $('<button>', {
        class: _.settings.classBtnSearch + ' dropdown-toggle',
        type: 'button',
        id: _.ids.dropdownButtonId,
        'data-toggle': 'dropdown',
        'data-target': '#' + _.ids.dropdownContainerId,
        'aria-haspopup': 'true',
        'aria-expanded': 'false'
      });
    },
    buildButtonClear(){
      var _ = this;
      return $('<button>', {
        type: 'button',
        class: _.settings.classBtnClear
      })
      .html( _.settings.htmlClear );
    },
    buildSearchControl() {
      var _ = this;
      return $('<input>', {
        type: 'text',
        class: 'form-control',
        placeholder: 'Search',
        'aria-label': 'Search',
        'aria-describedby': _.ids.searchControlId
      });
    },
    buildDropdownMenu() {
      var _ = this;
      var $dropdownMenu = $('<div>', {
        class: _.settings.classMenu,
        'aria-labelledby': _.ids.dropdownButtonId
      });
      if ( _.settings.maxHeight ) {
        $dropdownMenu
          .css({
            'height': 'auto',
            'max-height': _.settings.maxHeight,
            'overflow-x': 'hidden'
          });
      }
      return $dropdownMenu;
    },
    buildDropdownItemsContainer() {
      return $('<div>');
    },
    buildDropdownItems() {
      var _ = this;
      var $el = $( _.element );
      var s = 0; // Sort index
      var o = 0; // Option index
      var $items = $();
      var $optgroups = $el.find('optgroup');
      if ( $optgroups.length ) {
        $optgroups.each( function(){
          $items = $items.add( _.buildDropdownHeader( $( this ).attr('label') ).data('index', s ) );
          s = _.incrementIndex( s );
          $( this ).find('option').each( function() {
            $items = $items.add( _.buildDropdownItem( $( this ) ).data('index', s ).data('option', o) );
            s = _.incrementIndex( s );
            o++;
          });
        });
      } else {
        $el.find('option').each( function( index, value ) {
          $items = $items.add( _.buildDropdownItem( $( this ) ).data('index', s ).data('option', o) );
          s = _.incrementIndex( s );
          o++;
        });
      }
      if ( _.settings.search ) {
        $items = $items.add( _.els.dropdownItemNoResults );
      }
      return $items;
    },
    incrementIndex( index ) {
      var _ = this;
      _.data.indexes.push( index.toString() );
      index++;
      return index;
    },
    buildDropdownHeader( text ) {
      return $( '<h6>', {
        class: 'dropdown-header',
        text: text
      });
    },
    buildDropdownItem( $option ) {
      var _ = this;
      var $dropdownItem = $( '<a>', {
        href: '#',
        class: _.settings.classItem,
        text: $option.text()
      });
      if ( $option.is(':selected') ) {
        $dropdownItem.addClass('active');
      }
      return $dropdownItem;
    },
    buildDropdownItemNoResults() {
      var _ = this;
      return $( '<span>', {
        class: _.settings.classItem + ' ' + 'text-muted no-results',
        text: _.settings.textNoResults
      }).hide();
    },
    buildDeselectAll() {
      var _ = this;
      var $deselectItem = $('<a>', {
        href: '#',
        id: _.ids.dropdownItemDeselect,
        class:  _.settings.classItem,
        text: 'Deselect all'
      });
      return $deselectItem;
    },
    buildShowSelected() {
      var _ = this;
      var $showSelectedItem = $('<a>', {
        href: '#',
        id: _.ids.dropdownItemShowSelected,
        class:  _.settings.classItem,
        text: 'Show selected'
      });
      return $showSelectedItem;
    },
    dropdownActive() {
      var _ = this;
      if ( _.els.dropdown.hasClass('show') ) {
        return true;
      }
      return false;
    },
    /**
     * Check if a dropdown item refers to a select option.
     * @param  {object}  $item jQuery object.
     * @return {Boolean}
     */
    isOption( $item ) {
      var attr = $item.data('option');
      if (typeof attr !== typeof undefined && attr !== false) {
        return true;
      }
      return false;
    },
    /**
     * Set hover class position.
     *
     * Move the hover class to a designated dropdown option. If the index points
     * to a non-option, the next option will be modified.
     * @param {integer} index Dropdown menu item index.
     */
    setHover( index ) {
      var _ = this;
      _.els.dropdownOptions.removeClass('hover');
      if ( typeof index === typeof undefined ) {
        var $item = _.els.dropdownOptions.first();
      } else {
        var $item = _.dropdownItemByIndex( index );
      }
      _.data.hoverItem = $item;
      $item.addClass('hover');
    },
    hoverUp() {
      var _ = this;
      var current = _.data.hoverItem;
      if (
        typeof current !== typeof undefined &&
        current.length
      ) {
        var prev = current.prevAll('a:visible').first();
      }
      if ( typeof prev !== typeof undefined && prev.length ) {
        current.removeClass('hover');
        prev.addClass('hover');
        _.data.hoverItem = prev;
      }
    },
    hoverDown() {
      var _ = this;
      var current = _.data.hoverItem;
      if (
        typeof current !== typeof undefined &&
        current.length
      ) {
        var next = current.nextAll('a:visible').first();
      }
      if ( typeof next !== typeof undefined && next.length ) {
        current.removeClass('hover');
        next.addClass('hover');
        _.data.hoverItem = next;
      }
    },
    toggle( $dropdownItem ) {
      var _ = this;
      var $el =  $( _.element );
      var itemIndex = $dropdownItem.data('option');
      var $option = $el.find('option').eq( itemIndex );
      if ( $option.is(':selected') ) {
        $option.prop('selected', false);
        $dropdownItem.removeClass('active');
      }
      else {
        if ( !_.data.multiselect ) {
          _.els.dropdownOptions.removeClass('active');
        }
        $option.prop('selected', true);
        $dropdownItem.addClass('active');
      }
      _.setButtonText();
      _.refreshInitialControls();
    },
    deselectAll() {
      var _ = this;
      var $el =  $( _.element );
      _.els.dropdownOptions.each( function(){
        _.deselect( $( this ) );
      });
      if ( _.data.status == 'sort-selected' ) {
        _.refresh();
      }
    },
    deselect( $dropdownItem ){
      var _ = this;
      var $el =  $( _.element );
      var itemIndex = $dropdownItem.data('option');
      var $option = $el.find('option').eq( itemIndex );
      if ( $option.is(':selected') ) {
        _.toggle( $dropdownItem );
      }
    },
    setButtonText() {
      var _ = this;
      var $el = $( _.element );
      var $btn = _.els.button;
      var selected = $el.val();
      if ( selected.length < 1 ) {
        $btn.text( _.settings.textNoneSelected );
      }
      else if ( selected.length <= _.settings.maxListLength ) {
        var textValues = $el
          .find('option:selected')
          .map(function (i, element) {
            return $(element).text();
          })
          .get();
        $btn.text( textValues.join(", ") );
      }
      else {
        $btn.text( _.settings.textMultipleSelected );
      }
    },
    refresh() {
      var _ = this;
      _.data.status = 'initial';
      _.els.dropdownItems.removeClass('hover').show();
      _.els.dropdownItemNoResults.hide();
      _.sortReset();
      _.showInitialControls();
    },
    hide( results ) {
      var _ = this;
      var notResults = $(_.data.indexes).not(results).get();
      $.each( notResults, function( index, value ) {
        _.dropdownItemByIndex( value ).hide();
      });
      _.els.button.dropdown('update');
    },
    dropdownItemByIndex( index ) {
      var _ = this;
      return _.els.dropdownItems.filter( function(){
        return $(this).data('index') == index;
      });
    },
    hideInitialControls() {
      var _ = this;
      _.els.controlDeselect.hide();
      _.els.controlSelected.hide();
    },
    showInitialControls( prepend ) {
      prepend = (typeof prepend !== typeof undefined ) ?  prepend : false;
      var _ = this;
      if ( prepend ) {
        _.els.controlSelected.prependTo( _.els.dropdown );
        _.els.controlDeselect.prependTo( _.els.dropdown );
      }
      _.els.controlSelected.show();
      _.els.controlDeselect.show();
    },
    refreshInitialControls() {
      var _ = this;
      var $el = $( _.element );
      if ( !$el.val() || $el.val().length == 0 ) {
        _.els.controlDeselect.addClass('disabled');
        _.els.controlSelected.addClass('disabled');
      } else {
        _.els.controlDeselect.removeClass('disabled');
        _.els.controlSelected.removeClass('disabled');
      }
    },
    /**
     * Sort: Reset sort order.
     * @return void
     */
    sortReset() {
      var _ = this;
      for ( i = _.els.dropdownItems.length; i >= 0; i--) {
        _.dropdownItemByIndex( i ).prependTo( _.els.dropdownItemsContainer );
      }
    },
    /**
     * Sort: Order by array values.
     *
     * Reorder according to an array of index values. The order of the index
     * array is preserved, to make change detection easier elsewhere.
     * @param  {array} indexes Array of index values (strings).
     * @return void
     */
    reorder( indexes ) {
      var _ = this;
      _.els.dropdownItemNoResults.hide();
      if ( typeof indexes === typeof undefined || indexes.length == 0) {
        _.els.dropdownItemNoResults.show();
        return;
      }
      var indexesReversed = indexes.slice(0); // Clone
      indexesReversed = indexesReversed.reverse();
      $.each( indexesReversed, function( index, value ) {
        _.dropdownItemByIndex( value ).prependTo( _.els.dropdownItemsContainer );
      });
      _.hideInitialControls();
    },
    /**
     * Sort: Move selected items to the top.
     * @return void
     */
    sortSelected() {
      var _ = this;
      var $el = $( _.element );
      _.els.dropdownOptions.removeClass('hover');
      $( _.els.dropdown.find('.active').get().reverse() ).each( function(){
        $( this ).prependTo( _.els.dropdownItemsContainer );
      });
      _.showInitialControls( true );
      _.data.status = 'sort-selected';
      _.resetScroll();
    },
    /**
     * Helper: Reset scroll.
     *
     * Scroll the dropdown menu to the top.
     * @return {[type]} [description]
     */
    resetScroll() {
      var _ = this;
      _.els.dropdown.animate({
          scrollTop: 0
      }, 50);
    },
    /**
     * Helper: Class to selector.
     *
     * Convert a space separated class list to a selector.
     * @param  {string} classList Space separated list of classes.
     * @return {string}           Selector.
     */
    classListToSelector( classList ) {
      var selector = classList;
      if ( classList.length ) {
        var classes = classList.split(/\s+/);
        selector = '.' + classes.join('.');
      }
      return selector;
    },
    /**
     * Helper: Compare two arrays.
     *
     * @see https://stackoverflow.com/questions/3115982/how-to-check-if-two-arrays-are-equal-with-javascript
     */
    arraysEqual( a, b ) {
      if (a === b) return true;
      if (a == null || b == null) return false;
      if (a.length != b.length) return false;
      for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }
  } );

  $.fn[ pluginName ] = function( options ) {
    return this.each( function() {
      if ( !$.data( this, "plugin_" + pluginName ) ) {
        index++;
        $.data( this, "plugin_" +
          pluginName, new Plugin( this, options, index ) );
      }
    } );
  };
}));
