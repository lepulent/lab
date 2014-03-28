define(function() {

  var NumericOutputView = require('common/views/numeric-output-view'),
      BasicDialog       = require('common/controllers/basic-dialog'),
      viewState = require('common/views/view-state');

  return function(model, modelUrl) {

    // TODO use the formatter from the property description. Right now, it automatically adds
    // units to the returned string (which we don't want here).
    var format = d3.format('.2f');
    var sensorReadingView;
    var view;

    function setCanTareState() {
      if (model.properties.canTare) {
        viewState.enableView(view.$zeroButton);
      } else {
        viewState.disableView(view.$zeroButton);
      }
    }

    function setCanConnectState() {
      if (model.properties.canConnect) {
        viewState.enableView(view.$connectButton);
      } else {
        viewState.disableView(view.$connectButton);
      }
    }

    function setHasMultipleSensorsState() {
      if (model.properties.hasMultipleSensors) {
        viewState.enableView(view.$selectSensorButton);
      } else {
        viewState.disableView(view.$selectSensorButton);
      }
    }

    function setMessageText() {
      view.$message.text(model.properties.message);
    }

    function setupModelObservers() {
      model.addObserver('canTare', setCanTareState);
      setCanTareState();

      model.addObserver('canConnect', setCanConnectState);
      setCanConnectState();

      model.addObserver('hasMultipleSensors', setHasMultipleSensorsState);
      setHasMultipleSensorsState();

      model.addObserver('message', setMessageText);
      setMessageText();
    }

    function chooseSensorPopup() {
      var dialog = new BasicDialog({
        width: "60%",
        dialogClass: 'interactive-dialog no-close',
        closeOnEscape: false,
        title: "Choose a sensor:",
        buttons: {
          OK: function() {
            console.log("OK Clicked");
            $(this).dialog("close");
            // TODO Change the model's selected sensor
          },
          Cancel: function() {
            console.log("Cancel Clicked");
            $(this).dialog("close");
            // TODO Make sure the model continues using the previously selected sensor
          }
        }
      });

      dialog.setContent("Some content + the list of available sensors");
      dialog.open();
    }

    return view = {
      $el: $("<div id='model-container' class='container sensor-model-container' />"),
      remoteAddress: null,

      bindModel: function(newModel, newModelUrl) {
        modelUrl = newModelUrl || modelUrl;
        model = newModel || model;

        setupModelObservers();
      },

      getHeightForWidth: function() {
        return "2.6em";
      },

      // called once we're in the DOM
      setup: function() {
        view.$el.empty();
        view.$addressInput = $("<div class='address-input'><input type='text' name='address-input' placeholder='address of LabQuest2'></input></div>");
        sensorReadingView = new NumericOutputView({
          id: 'sensor-value-view',
          label: "Reading: ",
          units: model.getPropertyDescription('sensorReading').getUnitAbbreviation()
        });

        view.$connectButton = $("<div class='interactive-button'><button>Connect</button></div>");
        view.$zeroButton = $("<div class='interactive-button'><button>Zero</button></div>");
        view.$selectSensorButton = $("<div class='interactive-button'><button>Select Sensor</button></div>");
        view.$message = $("<div class='message'></div>");
        view.$sensorReading = sensorReadingView.render().addClass("horizontal");

        view.$el.css('zIndex', 4)
          .append(view.$addressInput)
          .append(view.$connectButton)
          .append(view.$sensorReading)
          .append(view.$zeroButton)
          .append(view.$selectSensorButton)
          .append(view.$message);

        view.$el.find('div').addClass('component component-spacing');
        sensorReadingView.resize();
        setupModelObservers();

        if (typeof(view.remoteAddress) == "string") {
          view.$addressInput.find('input').val(view.remoteAddress);
        }
        view.$addressInput.find('input').on('change', function() {
          view.remoteAddress = $(this).val();
        });

        view.$connectButton.on('click', 'button', function() {
          model.connect(view.$addressInput.find('input').val());
        });
        view.$zeroButton.on('click', 'button', model.tare);
        view.$selectSensorButton.on('click', 'button', chooseSensorPopup);
      },

      resize: function() {
        if (sensorReadingView) {
          sensorReadingView.resize();
        }
      },

      repaint: function() {},

      setFocus: function () {},

      updateUnits: function(units) {
        sensorReadingView.updateUnits(units);
        if (model.properties.liveSensorReading == null) {
          sensorReadingView.hideUnits();
        }
      },

      update: function() {
        if (model.properties.liveSensorReading == null) {
          sensorReadingView.update("");
          sensorReadingView.hideUnits();
        } else {
          sensorReadingView.update(format(model.properties.liveSensorReading));
          sensorReadingView.showUnits();
        }
      }
    };
  };
});
