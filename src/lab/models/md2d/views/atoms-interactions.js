/*global define: false */

define(function(require) {
  // Dependencies.
  var alert               = require('common/alert'),
      amniacidContextMenu = require('cs!models/md2d/views/aminoacid-context-menu'),

      POINT_CACHE = {},

      TRANSLATE = 'translate',
      ROTATE = 'rotate';

  function getAngle(cx, cy, x, y) {
    return Math.atan2(x - cx, y - cy);
  }

  function rotate(x, y, angle) {
    return {
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle)
    };
  }

  return function AtomsInteractions(modelView, model, target) {
    var api,

        m2px,
        m2pxInv,

        atoms,
        modelWidth,
        modelHeight,

        $target,
        targetOffset,
        targetOversampling,
        viewportX,
        viewportY,

        downAtom,
        contextMenuAtom,
        dragging, dragged;

    //**********************************************************************************************
    // Event handlers related to particular atom:
    function mouseDownHandler(x, y, atom, e) {
      // Dragging is only allowed when user touches an atom or uses *left* mouse button (== 0).
      // Right mouse button can interfere with context menus.
      if (e.button === 0) {
        var mode = null;
        if (isAtomRotatable(atom)) {
          // When atom can be rotated (which means it's part of the molecule) we have more options.
          // 'onAtomDrag' model property defines preferred drag behavior.
          var modes = model.get('onAtomDrag') === TRANSLATE ? [TRANSLATE, ROTATE] : [ROTATE, TRANSLATE];
          // Option key can activate non-default drag behavior.
          mode = e.altKey ? modes[1] : modes[0];
        } else if (isAtomDraggable(atom)) {
          mode = TRANSLATE;
        }
        if (mode !== null) {
          dragBehavior(downAtom, mode);
        }
      }
    }

    function mouseOverHandler(x, y, atom, e) {
      // noop
    }

    function mouseOutHandler(x, y, e) {
      // noop
    }

    function mouseUpHandler(x, y, atom, e) {
      // noop
    }

    function clickHandler(x, y, atom, e) {
      // Custom click handlers for atoms are not supposed to be triggered if the atom was dragged
      if (!dragged && modelView.clickHandler[".atom"]) {
        modelView.clickHandler[".atom"](x, y, atom, atom.idx);
      }
    }

    function contextMenuHandler(x, y, atom, e) {
      // noop
    }

    //**********************************************************************************************
    // Event handlers related to whole target element (canvas):
    function mouseDownCanvas(e) {
      var p = getClickCoords(e);

      downAtom = getAtomUnder(p.x, p.y);
      contextMenuAtom = null;
      dragged = false;

      modelView.hitTestCallback(!!downAtom);
      if (downAtom) {
        mouseDownHandler(p.x, p.y, downAtom, e);
      }
    }

    function mouseMoveCanvas(e) {
      var p = getClickCoords(e),
          atom = getAtomUnder(p.x, p.y);

      modelView.hitTestCallback(!!atom);
      if (atom) {
        mouseOverHandler(p.x, p.y, atom, e);
      } else {
        mouseOutHandler(p.x, p.y, e);
      }
      if (!dragging) {
        setCursorForAtom(atom);
      }
    }

    function mouseUpCanvas(e) {
      var p = getClickCoords(e),
          upAtom = getAtomUnder(p.x, p.y),
          isDOMClick = false;

      modelView.hitTestCallback(!!upAtom);

      if (upAtom) {
        mouseUpHandler(p.x, p.y, upAtom, e);
        if (upAtom === downAtom) {
          // Regardless of whether or not the atom was dragged, if mouseup target == mousedown
          // target we should issue a DOM click event.
          isDOMClick = true;
          clickHandler(p.x, p.y, downAtom);
        }
      }

      modelView.mouseupCallback(isDOMClick);
      downAtom = null;
    }

    function mouseOverCanvas(e) {
      // noop
    }

    function mouseOutCanvas(e) {
      var p = getClickCoords(e);
      mouseOutHandler(p.x, p.y, e);
      setCursor("auto");
    }

    function contextMenuCanvas(e) {
      var p = getClickCoords(e);

      contextMenuAtom = !dragged && getAtomUnder(p.x, p.y);

      modelView.hitTestCallback(!!contextMenuAtom);
      if (contextMenuAtom) {
        contextMenuHandler(p.x, p.y, contextMenuAtom);
      }
    }
    //**********************************************************************************************

    function setCursorFromEvent(e) {
      // If pointer is over some other element just restore the "auto" pointer.
      if (e.target !== target) {
        setCursor("auto");
        return;
      }
      var p = getClickCoords(e);
      setCursorForAtom(getAtomUnder(p.x, p.y));
    }

    function isAtomDraggable(atom) {
      if ( ! atom ) {
        return false;
      }
      if (model.isStopped()) {
        return atom.draggableWhenStopped || model.properties.isBeingEdited;
      }
      return atom.draggable;
    }

    function isAtomRotatable(atom) {
      if (!atom) {
        return false;
      }
      // Note that getMoleculeAtoms doesn't include atom index that we provide, so > 0 means it's part of the molecule.
      // We also require atom to be draggable since the rotation is triggered by dragging.
      return isAtomDraggable(atom) && model.isStopped() && model.getMoleculeAtoms(atom.idx).length > 0;
    }

    function setCursorForAtom(atom) {
      if (isAtomDraggable(atom)) {
        setCursor("move");
      } else {
        setCursor("auto");
      }
    }

    var cursorVal;
    function setCursor(name) {
      if (cursorVal !== name) {
        cursorVal = name;
        document.documentElement.style.cursor = name;
      }
    }

    function init() {
      m2px = modelView.model2canvas;
      m2pxInv = modelView.model2canvasInv;

      $target = $(target);
      $target.addClass("atoms-interaction-layer");

      $target.on("mousedown.atoms-interactions", mouseDownCanvas);
      $target.on("mouseup.atoms-interactions", mouseUpCanvas);
      $target.on("mousemove.atoms-interactions", mouseMoveCanvas);
      $target.on("mouseover.atoms-interactions", mouseOverCanvas);
      $target.on("mouseout.atoms-interactions", mouseOutCanvas);
      $target.on("contextmenu.atoms-interactions", contextMenuCanvas);

      api.bindModel(model);
    }

    function getAtomUnder(x, y) {
      var atom, ax, ay, ar;
      // Very important - start from the last atom. Order of atoms defines order of rendering.
      for (var i = atoms.length - 1; i >= 0; i--) {
        atom = atoms[i];
        ax = atom.x;
        ay = atom.y;
        ar = atom.radius;
        // Optimization: hit area is square.
        if (x > ax - ar && x < ax + ar && y > ay - ar && y < ay + ar) {
          return atom;
        }
      }
      return null;
    }

    function getClickCoords(e, useCachedDimensionsAndViewport) {
      if (!useCachedDimensionsAndViewport) {
        // Sometimes we can risk and assume that model view wasn't resized or view port properties
        // changed (e.g. during atom dragging).
        targetOffset = $target.offset();
        targetOversampling = $target.attr("width") / $target.width();
        // Undefined is a perfectly correct value for view port coords, it means that the whole
        // model area is being displayed.
        viewportX = model.get("viewPortX") || 0;
        viewportY = model.get("viewPortY") || 0;
      }

      POINT_CACHE.x = m2px.invert((e.pageX - targetOffset.left) * targetOversampling) + viewportX;
      POINT_CACHE.y = m2pxInv.invert((e.pageY - targetOffset.top) * targetOversampling) + viewportY;
      return POINT_CACHE;
    }

    function dragBehavior(atom, mode) {
      var translate = mode === TRANSLATE,
          originalPositions, prevAngle, molecule, cx, cy;

      $(window).on("mousemove.lab-drag", function (e) {
        // Prevent accidental text selection or another unwanted action while dragging.
        e.preventDefault();

        // We can use cached canvas dimensions, as they rather don't change between mousedown
        // and mousemove.
        var p = getClickCoords(e, true);
        var x = p.x;
        var y = p.y;

        if (!dragged) {
          // Lazily initialize drag process when user really drags an atom (not only clicks it).
          originalPositions = getMoleculePositions(atom);
          if (translate) {
            if (!model.isStopped() && atom.draggable) {
              model.liveDragStart(atom.idx);
            }
          } else { // rotate
            molecule = model.getMoleculeAtoms(atom.idx).concat(atom.idx);
            var bbox = model.getMoleculeBoundingBox(atom.idx);
            // A bit confusing, but bounding box returns values relative to the center of provided atom.
            cx = (atom.x + bbox.left + atom.x + bbox.right) * 0.5;
            cy = (atom.y + bbox.top + atom.y + bbox.bottom) * 0.5;
            prevAngle = getAngle(cx, cy, x, y);
          }
          dragging = true;
          dragged = true;
        }

        if (translate) {
          translateMolecule(atom, x, y);
        } else { // rotate
          var newAngle = getAngle(cx, cy, x, y);
          rotateMolecule(molecule, cx, cy, prevAngle - newAngle);
          prevAngle = newAngle;
        }
        setCursor("move");
        // Custom drag handler. Note that it works both for translation and rotation.
        if (modelView.dragHandler.atom) {
          modelView.dragHandler.atom(x, y, atom, atom.idx);
        }
        modelView.update();
      }).on("selectstart.lab-drag", function (e) {
        // Disable selection behavior while dragging an atom. It's supported and required in IE and
        // Safari. In Chrome it's enough to call .preventDefault() on mousemove event.
        e.preventDefault();
      }).one("mouseup.lab-drag", function (e) {
        $(window).off(".lab-drag");
        // If user only clicked an atom (mousedown + mouseup, no mousemove), nothing to do.
        if (!dragged) return;
        dragging = false;
        // Prevent accidental text selection or another unwanted action while dragging.
        e.preventDefault();
        // Pointer can be over atom or not (e.g. when user finished dragging below other object).
        setCursorFromEvent(e);

        if (translate && !model.isStopped()) {
          model.liveDragEnd();
        }

        // Validate final position.
        if (model.isStopped()) {
          if (!isPositionValid(atom.idx)) {
            alert(modelView.i18n.t('md2d.invalid_object_position_alert'));
            restoreMoleculePositions(originalPositions);
            modelView.update();
          }
        }
      });
    }

    function getMoleculePositions(atom) {
      var molecule = model.getMoleculeAtoms(atom.idx).concat(atom.idx);
      return molecule.map(function (idx) {
        var atom = model.getAtomProperties(idx);
        return {
          idx: idx,
          x: atom.x,
          y: atom.y
        }
      });
    }

    function restoreMoleculePositions(moleculePositions) {
      moleculePositions.forEach(function (data) {
        setAtomPosition(data.idx, data.x, data.y);
      });
    }

    function translateMolecule(atom, x, y) {
      var bbox = model.getMoleculeBoundingBox(atom.idx);
      if (bbox.left + x < 0) x = 0 - bbox.left;
      if (bbox.right + x > modelWidth) x = modelWidth - bbox.right;
      if (bbox.bottom + y < 0) y = 0 - bbox.bottom;
      if (bbox.top + y > modelHeight) y = modelHeight - bbox.top;

      if (model.isStopped()) {
        setMoleculePosition(atom.idx, x, y);
      } else {
        model.liveDrag(x, y);
      }
    }

    function setAtomPosition(i, xpos, ypos) {
      return model.setAtomProperties(i, {x: xpos, y: ypos});
    }

    function setMoleculePosition(i, xpos, ypos) {
      // The last argument ensures that the whole molecule will be moved.
      return model.setAtomProperties(i, {x: xpos, y: ypos}, false, true);
    }

    function isPositionValid(atomIdx) {
      // To validate position it's enough to set properties (even empty set) and make sure that "checkLocation"
      // and "moveMolecule" arguments are set to true.
      return model.setAtomProperties(atomIdx, {}, true, true);
    }

    function rotateMolecule(molecule, cx, cy, angle) {
      if (angle === 0) return;

      var rotationAllowed = true;
      for (var i = 0, len = molecule.length; i < len; i++) {
        var idx = molecule[i];
        var atom = model.getAtomProperties(idx);
        var newCoords = rotate(atom.x - cx, atom.y - cy, angle);
        var posAllowed = setAtomPosition(idx, newCoords.x + cx, newCoords.y + cy);
        rotationAllowed = rotationAllowed && posAllowed;
      }
      return rotationAllowed;
    }

    api = {
      bindModel: function (newModel) {
        model = newModel;

        atoms = model.getAtoms();
        modelWidth = model.get("width");
        modelHeight = model.get("height");

        // .register method destroys old menu instances first, so it's safe to call it each time we bind a new model.
        amniacidContextMenu.register(model, modelView, ".atoms-interaction-layer", function () {
          return contextMenuAtom;
        });
      }
    };

    init();

    return api;
  };
});
