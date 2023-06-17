import { Event as SlickEvent_, EventData as EventData_, EventHandler as EventHandler_, keyCode as keyCode_, Range as SlickRange_, Utils as Utils_ } from '../slick.core';
import { Draggable as Draggable_ } from '../slick.interactions';
import { CellRangeDecorator as CellRangeDecorator_ } from './slick.cellrangedecorator';
import { CellRangeSelector as CellRangeSelector_ } from './slick.cellrangeselector';

// for (iife) load Slick methods from global Slick object, or use imports for (cjs/esm)
const EventData = IIFE_ONLY ? Slick.EventData : EventData_;
const EventHandler = IIFE_ONLY ? Slick.EventHandler : EventHandler_;
const keyCode = IIFE_ONLY ? Slick.keyCode : keyCode_;
const SlickEvent = IIFE_ONLY ? Slick.Event : SlickEvent_;
const SlickRange = IIFE_ONLY ? Slick.Range : SlickRange_;
const Draggable = IIFE_ONLY ? Slick.Draggable : Draggable_;
const CellRangeDecorator = IIFE_ONLY ? Slick.CellRangeDecorator : CellRangeDecorator_;
const CellRangeSelector = IIFE_ONLY ? Slick.CellRangeSelector : CellRangeSelector_;
const Utils = IIFE_ONLY ? Slick.Utils : Utils_;

export function RowSelectionModel(options) {
    var _grid;
    var _ranges = [];
    var _self = this;
  var _handler = new EventHandler();
    var _inHandler;
    var _options;
    var _selector;
    var _isRowMoveManagerHandler;
    var _defaults = {
      selectActiveRow: true,
      dragToSelect: false,
      autoScrollWhenDrag: true,
      cellRangeSelector: undefined
    };

    function init(grid) {
      if (typeof Draggable === "undefined") {
        throw new Error('Slick.Draggable is undefined, make sure to import "slick.interactions.js"');
      }

      _options = Utils.extend(true, {}, _defaults, options);
      _selector = _options.cellRangeSelector;
      _grid = grid;

      if (!_selector && _options.dragToSelect) {
        if (!CellRangeDecorator) {
            throw new Error("Slick.CellRangeDecorator is required when option dragToSelect set to true");
        }
        _selector = new CellRangeSelector({
          selectionCss: {
            "border": "none"
          },
          autoScroll: _options.autoScrollWhenDrag
        })
      }

      _handler.subscribe(_grid.onActiveCellChanged,
          wrapHandler(handleActiveCellChange));
      _handler.subscribe(_grid.onKeyDown,
          wrapHandler(handleKeyDown));
      _handler.subscribe(_grid.onClick,
          wrapHandler(handleClick));
      if (_selector) {
        grid.registerPlugin(_selector);
        _selector.onCellRangeSelecting.subscribe(handleCellRangeSelected);
        _selector.onCellRangeSelected.subscribe(handleCellRangeSelected);
        _selector.onBeforeCellRangeSelected.subscribe(handleBeforeCellRangeSelected);
      }
    }

    function destroy() {
      _handler.unsubscribeAll();
      if (_selector) {
        _selector.onCellRangeSelecting.unsubscribe(handleCellRangeSelected);
        _selector.onCellRangeSelected.unsubscribe(handleCellRangeSelected);
        _selector.onBeforeCellRangeSelected.unsubscribe(handleBeforeCellRangeSelected);
        _grid.unregisterPlugin(_selector);
        if (_selector.destroy) {
          _selector.destroy();
        }
      }
    }

    function wrapHandler(handler) {
      return function () {
        if (!_inHandler) {
          _inHandler = true;
          handler.apply(this, arguments);
          _inHandler = false;
        }
      };
    }

    function rangesToRows(ranges) {
      var rows = [];
      for (var i = 0; i < ranges.length; i++) {
        for (var j = ranges[i].fromRow; j <= ranges[i].toRow; j++) {
          rows.push(j);
        }
      }
      return rows;
    }

    function rowsToRanges(rows) {
      var ranges = [];
      var lastCell = _grid.getColumns().length - 1;
      for (var i = 0; i < rows.length; i++) {
        ranges.push(new SlickRange(rows[i], 0, rows[i], lastCell));
      }
      return ranges;
    }

    function getRowsRange(from, to) {
      var i, rows = [];
      for (i = from; i <= to; i++) {
        rows.push(i);
      }
      for (i = to; i < from; i++) {
        rows.push(i);
      }
      return rows;
    }

    function getSelectedRows() {
      return rangesToRows(_ranges);
    }

    function setSelectedRows(rows) {
      setSelectedRanges(rowsToRanges(rows), "SlickRowSelectionModel.setSelectedRows");
    }

    function setSelectedRanges(ranges, caller) {
      // simple check for: empty selection didn't change, prevent firing onSelectedRangesChanged
      if ((!_ranges || _ranges.length === 0) && (!ranges || ranges.length === 0)) {
        return;
      }
      _ranges = ranges;

      // provide extra "caller" argument through SlickEventData to avoid breaking pubsub event that only accepts an array of selected range
      var eventData = new EventData(null, _ranges);
      Object.defineProperty(eventData, 'detail', { writable: true, configurable: true, value: { caller: caller || "SlickRowSelectionModel.setSelectedRanges" } });
      _self.onSelectedRangesChanged.notify(_ranges, eventData);
    }

    function getSelectedRanges() {
      return _ranges;
    }

    function refreshSelections() {
      setSelectedRows(getSelectedRows());
    }

    function handleActiveCellChange(e, data) {
      if (_options.selectActiveRow && data.row != null) {
        setSelectedRanges([new SlickRange(data.row, 0, data.row, _grid.getColumns().length - 1)]);
      }
    }

    function handleKeyDown(e) {
      var activeRow = _grid.getActiveCell();
      if (_grid.getOptions().multiSelect && activeRow
        && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey
        && (e.which == keyCode.UP || e.which == keyCode.DOWN)) {
        var selectedRows = getSelectedRows();
        selectedRows.sort(function (x, y) {
          return x - y;
        });

        if (!selectedRows.length) {
          selectedRows = [activeRow.row];
        }

        var top = selectedRows[0];
        var bottom = selectedRows[selectedRows.length - 1];
        var active;

        if (e.which == keyCode.DOWN) {
          active = activeRow.row < bottom || top == bottom ? ++bottom : ++top;
        } else {
          active = activeRow.row < bottom ? --bottom : --top;
        }

        if (active >= 0 && active < _grid.getDataLength()) {
          _grid.scrollRowIntoView(active);
          var tempRanges = rowsToRanges(getRowsRange(top, bottom));
          setSelectedRanges(tempRanges);
        }

        e.preventDefault();
        e.stopPropagation();
      }
    }

    function handleClick(e) {
      var cell = _grid.getCellFromEvent(e);
      if (!cell || !_grid.canCellBeActive(cell.row, cell.cell)) {
        return false;
      }

      if (!_grid.getOptions().multiSelect || (
          !e.ctrlKey && !e.shiftKey && !e.metaKey)) {
        return false;
      }

      var selection = rangesToRows(_ranges);
      var idx = selection.indexOf(cell.row);

      if (idx === -1 && (e.ctrlKey || e.metaKey)) {
        selection.push(cell.row);
        _grid.setActiveCell(cell.row, cell.cell);
      } else if (idx !== -1 && (e.ctrlKey || e.metaKey)) {
        selection = selection.filter((o) => o !== cell.row);
        _grid.setActiveCell(cell.row, cell.cell);
      } else if (selection.length && e.shiftKey) {
        var last = selection.pop();
        var from = Math.min(cell.row, last);
        var to = Math.max(cell.row, last);
        selection = [];
        for (var i = from; i <= to; i++) {
          if (i !== last) {
            selection.push(i);
          }
        }
        selection.push(last);
        _grid.setActiveCell(cell.row, cell.cell);
      }

      var tempRanges = rowsToRanges(selection);
      setSelectedRanges(tempRanges);
      e.stopImmediatePropagation();

      return true;
    }

    function handleBeforeCellRangeSelected(e, cell) {
      if (!_isRowMoveManagerHandler) {
        var rowMoveManager = _grid.getPluginByName('RowMoveManager') || _grid.getPluginByName('CrossGridRowMoveManager');
        _isRowMoveManagerHandler = rowMoveManager ? rowMoveManager.isHandlerColumn : Utils.noop;
      }
      if (_grid.getEditorLock().isActive() || _isRowMoveManagerHandler(cell.cell)) {
        e.stopPropagation();
        return false;
      }
      _grid.setActiveCell(cell.row, cell.cell);
    }

    function handleCellRangeSelected(e, args) {
      if (!_grid.getOptions().multiSelect || !_options.selectActiveRow) {
        return false;
      }
      setSelectedRanges([new SlickRange(args.range.fromRow, 0, args.range.toRow, _grid.getColumns().length - 1)])
    }

  Utils.extend(this, {
      "getSelectedRows": getSelectedRows,
      "setSelectedRows": setSelectedRows,

      "getSelectedRanges": getSelectedRanges,
      "setSelectedRanges": setSelectedRanges,

      "refreshSelections": refreshSelections,

      "init": init,
      "destroy": destroy,
      "pluginName": "RowSelectionModel",

    "onSelectedRangesChanged": new SlickEvent()
    });
  }

// extend Slick namespace on window object when building as iife
if (IIFE_ONLY && window.Slick) {
  Utils.extend(true, window, {
    Slick: {
      RowSelectionModel
    }
  });
}

