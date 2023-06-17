import { Event as SlickEvent_, EventData as EventData_, Range as Range_, Utils as Utils_ } from '../slick.core';
import { CellRangeSelector as CellRangeSelector_ } from './slick.cellrangeselector';

// for (iife) load Slick methods from global Slick object, or use imports for (cjs/esm)
const SlickEvent = IIFE_ONLY ? Slick.Event : SlickEvent_;
const EventData = IIFE_ONLY ? Slick.EventData : EventData_;
const SlickRange = IIFE_ONLY ? Slick.Range : Range_; // test
const CellRangeSelector = IIFE_ONLY ? Slick.CellRangeSelector : CellRangeSelector_;
const Utils = IIFE_ONLY ? Slick.Utils : Utils_;

export function CellSelectionModel(options) {
    var _grid;
    var _ranges = [];
    var _self = this;
    var _selector;

    if (typeof options === "undefined" || typeof options.cellRangeSelector === "undefined") {
      _selector = new CellRangeSelector({
        "selectionCss": {
          "border": "2px solid black"
        }
      });
    } else {
      _selector = options.cellRangeSelector;
    }

    var _options;
    var _defaults = {
      selectActiveCell: true
    };

    function init(grid) {
      _options = Utils.extend(true, {}, _defaults, options);
      _grid = grid;
      _grid.onActiveCellChanged.subscribe(handleActiveCellChange);
      _grid.onKeyDown.subscribe(handleKeyDown);
      grid.registerPlugin(_selector);
      _selector.onCellRangeSelected.subscribe(handleCellRangeSelected);
      _selector.onBeforeCellRangeSelected.subscribe(handleBeforeCellRangeSelected);
    }

    function destroy() {
      _grid.onActiveCellChanged.unsubscribe(handleActiveCellChange);
      _grid.onKeyDown.unsubscribe(handleKeyDown);
      _selector.onCellRangeSelected.unsubscribe(handleCellRangeSelected);
      _selector.onBeforeCellRangeSelected.unsubscribe(handleBeforeCellRangeSelected);
      _grid.unregisterPlugin(_selector);
      if (_selector && _selector.destroy) {
        _selector.destroy();
      }
    }

    function removeInvalidRanges(ranges) {
      var result = [];

      for (var i = 0; i < ranges.length; i++) {
        var r = ranges[i];
        if (_grid.canCellBeSelected(r.fromRow, r.fromCell) && _grid.canCellBeSelected(r.toRow, r.toCell)) {
          result.push(r);
        }
      }

      return result;
    }

    function rangesAreEqual(range1, range2) {
      var areDifferent = (range1.length !== range2.length);
      if (!areDifferent) {
        for (var i = 0; i < range1.length; i++) {
          if (
            range1[i].fromCell !== range2[i].fromCell
            || range1[i].fromRow !== range2[i].fromRow
            || range1[i].toCell !== range2[i].toCell
            || range1[i].toRow !== range2[i].toRow
          ) {
            areDifferent = true;
            break;
          }
        }
      }
      return !areDifferent;
    }

    function setSelectedRanges(ranges, caller) {
      // simple check for: empty selection didn't change, prevent firing onSelectedRangesChanged
      if ((!_ranges || _ranges.length === 0) && (!ranges || ranges.length === 0)) { return; }

      // if range has not changed, don't fire onSelectedRangesChanged
      var rangeHasChanged = !rangesAreEqual(_ranges, ranges);

      _ranges = removeInvalidRanges(ranges);
      if (rangeHasChanged) {
        // provide extra "caller" argument through SlickEventData to avoid breaking pubsub event that only accepts an array of selected range
        var eventData = new EventData(null, _ranges);
        Object.defineProperty(eventData, 'detail', { writable: true, configurable: true, value: { caller: caller || "SlickCellSelectionModel.setSelectedRanges" } });
        _self.onSelectedRangesChanged.notify(_ranges, eventData);
      }
    }

    function getSelectedRanges() {
      return _ranges;
    }

    function refreshSelections() {
      setSelectedRanges(getSelectedRanges());
    }

    function handleBeforeCellRangeSelected(e) {
      if (_grid.getEditorLock().isActive()) {
        e.stopPropagation();
        return false;
      }
    }

    function handleCellRangeSelected(e, args) {
      _grid.setActiveCell(args.range.fromRow, args.range.fromCell, false, false, true);
      setSelectedRanges([args.range]);
    }

    function handleActiveCellChange(e, args) {
      if (_options.selectActiveCell && args.row != null && args.cell != null) {
        setSelectedRanges([new SlickRange(args.row, args.cell)]);
      }
      else if (!_options.selectActiveCell) {
        // clear the previous selection once the cell changes
        setSelectedRanges([]);
      }
    }

    function handleKeyDown(e) {
      /***
       * Кey codes
       * 37 left
       * 38 up
       * 39 right
       * 40 down
       */
      var ranges, last;
      var active = _grid.getActiveCell();
      var metaKey = e.ctrlKey || e.metaKey;

      if (active && e.shiftKey && !metaKey && !e.altKey &&
        (e.which == 37 || e.which == 39 || e.which == 38 || e.which == 40)) {

        ranges = getSelectedRanges().slice();
        if (!ranges.length)
          ranges.push(new SlickRange(active.row, active.cell));

        // keyboard can work with last range only
        last = ranges.pop();

        // can't handle selection out of active cell
        if (!last.contains(active.row, active.cell))
          last = new SlickRange(active.row, active.cell);

        var dRow = last.toRow - last.fromRow,
          dCell = last.toCell - last.fromCell,
          // walking direction
          dirRow = active.row == last.fromRow ? 1 : -1,
          dirCell = active.cell == last.fromCell ? 1 : -1;

        if (e.which == 37) {
          dCell -= dirCell;
        } else if (e.which == 39) {
          dCell += dirCell;
        } else if (e.which == 38) {
          dRow -= dirRow;
        } else if (e.which == 40) {
          dRow += dirRow;
        }

        // define new selection range
        var new_last = new SlickRange(active.row, active.cell, active.row + dirRow * dRow, active.cell + dirCell * dCell);
        if (removeInvalidRanges([new_last]).length) {
          ranges.push(new_last);
          var viewRow = dirRow > 0 ? new_last.toRow : new_last.fromRow;
          var viewCell = dirCell > 0 ? new_last.toCell : new_last.fromCell;
          _grid.scrollRowIntoView(viewRow);
          _grid.scrollCellIntoView(viewRow, viewCell);
        }
        else
          ranges.push(last);

        setSelectedRanges(ranges);

        e.preventDefault();
        e.stopPropagation();
      }
    }

  Utils.extend(this, {
      "getSelectedRanges": getSelectedRanges,
      "setSelectedRanges": setSelectedRanges,

      "refreshSelections": refreshSelections,

      "init": init,
      "destroy": destroy,
      "pluginName": "CellSelectionModel",

    "onSelectedRangesChanged": new SlickEvent()
    });
}

// extend Slick namespace on window object when building as iife
if (IIFE_ONLY && window.Slick) {
  Utils.extend(true, window, {
    Slick: {
      CellSelectionModel
    }
  });
}