import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Text,
  ToastAndroid,
  View,
  Button,
} from "react-native";
import { NativeModules } from "react-native";
import {
  PERMISSIONS,
  requestMultiple,
  RESULTS,
} from "react-native-permissions";
import ItemList from "./ItemList";
import SamplePrint from "./SamplePrint";
import { styles } from "./styles";

const PrintModule = () => {
  const [pairedDevices, setPairedDevices] = useState([]);
  const [foundDs, setFoundDs] = useState([]);
  const [bleOpened, setBleOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [boundAddress, setBoundAddress] = useState("");
  const { BluetoothManager } = NativeModules;

  useEffect(() => {
    BluetoothManager.isBluetoothEnabled().then(
      (enabled) => {
        setBleOpened(Boolean(enabled));
        setLoading(false);
      },
      (err) => {
        err;
      }
    );

    if (Platform.OS === "ios") {
      let bluetoothManagerEmitter = new NativeEventEmitter(BluetoothManager);
      bluetoothManagerEmitter.addListener(
        BluetoothManager.EVENT_DEVICE_ALREADY_PAIRED,
        (rsp) => {
          deviceAlreadyPaired(rsp);
        }
      );
      bluetoothManagerEmitter.addListener(
        BluetoothManager.EVENT_DEVICE_FOUND,
        (rsp) => {
          deviceFoundEvent(rsp);
        }
      );
      bluetoothManagerEmitter.addListener(
        BluetoothManager.EVENT_CONNECTION_LOST,
        () => {
          setName("");
          setBoundAddress("");
        }
      );
    } else if (Platform.OS === "android") {
      DeviceEventEmitter.addListener(
        BluetoothManager.EVENT_DEVICE_ALREADY_PAIRED,
        (rsp) => {
          deviceAlreadyPaired(rsp);
        }
      );
      DeviceEventEmitter.addListener(
        BluetoothManager.EVENT_DEVICE_FOUND,
        (rsp) => {
          deviceFoundEvent(rsp);
        }
      );
      DeviceEventEmitter.addListener(
        BluetoothManager.EVENT_CONNECTION_LOST,
        () => {
          setName("");
          setBoundAddress("");
        }
      );
      DeviceEventEmitter.addListener(
        BluetoothManager.EVENT_BLUETOOTH_NOT_SUPPORT,
        () => {
          ToastAndroid.show(
            "Device Not Support Bluetooth !",
            ToastAndroid.LONG
          );
        }
      );
    }

    if (pairedDevices.length < 1) {
      scan();
      console.log("scanning...");
    } else {
      const firstDevice = pairedDevices[0];
      connect(firstDevice);
    }
  }, [pairedDevices]);

  const deviceAlreadyPaired = useCallback(
    (rsp) => {
      var ds = null;
      if (typeof rsp.devices === "object") {
        ds = rsp.devices;
      } else {
        try {
          ds = JSON.parse(rsp.devices);
        } catch (e) {}
      }
      if (ds && ds.length) {
        let pared = pairedDevices;
        if (pared.length < 1) {
          pared = pared.concat(ds || []);
        }
        setPairedDevices(pared);
      }
    },
    [pairedDevices]
  );

  const deviceFoundEvent = useCallback(
    (rsp) => {
      var r = null;
      try {
        if (typeof rsp.device === "object") {
          r = rsp.device;
        } else {
          r = JSON.parse(rsp.device);
        }
      } catch (e) {
        // ignore error
      }

      if (r) {
        let found = foundDs || [];
        if (found.findIndex) {
          let duplicated = found.findIndex(function (x) {
            return x.address == r.address;
          });
          if (duplicated == -1) {
            found.push(r);
            setFoundDs(found);
          }
        }
      }
    },
    [foundDs]
  );

  const connect = async (row) => {
    try {
      console.log(">>>>", row.address);
      setLoading(true);
      await BluetoothManager.connect(row.address);
      setLoading(false);
      setBoundAddress(row.address);
      setName(row.name || "UNKNOWN");
      console.log("Connected to device:", row);
    } catch (e) {
      setLoading(false);
      alert(e);
    }
  };

  const unPair = (address) => {
    setLoading(true);
    BluetoothManager.unpaire(address).then(
      (s) => {
        setLoading(false);
        setBoundAddress("");
        setName("");
      },
      (e) => {
        setLoading(false);
        alert(e);
      }
    );
  };

  const scanDevices = useCallback(() => {
    setLoading(true);
    BluetoothManager.scanDevices().then(
      (s) => {
        // const pairedDevices = s.paired;
        var found = s.found;
        try {
          found = JSON.parse(found); //@FIX_it: the parse action too..
        } catch (e) {
          //ignore
        }
        var fds = foundDs;
        if (found && found.length) {
          fds = found;
        }
        setFoundDs(fds);
        setLoading(false);
      },
      (er) => {
        setLoading(false);
        // ignore
      }
    );
  }, [foundDs]);

  const scan = useCallback(() => {
    try {
      async function blueTooth() {
        const permissions = {
          title: "HSD bluetooth",
          message: "HSD bluetooth printer",
          buttonNeutral: "Button",
          buttonNegative: "Button",
          buttonPositive: "Button",
        };

        const bluetoothConnectGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          permissions
        );
        if (bluetoothConnectGranted === PermissionsAndroid.RESULTS.GRANTED) {
          const bluetoothScanGranted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            permissions
          );
          if (bluetoothScanGranted === PermissionsAndroid.RESULTS.GRANTED) {
            scanDevices();
          }
        } else {
          // ignore akses ditolak
        }
      }
      blueTooth();
    } catch (err) {
      console.warn(err);
    }
  }, [scanDevices]);

  const scanBluetoothDevice = async () => {
    setLoading(true);
    try {
      const request = await requestMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ]);

      if (
        request["android.permission.ACCESS_FINE_LOCATION"] === RESULTS.GRANTED
      ) {
        scanDevices();
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.bluetoothStatusContainer}>
        <Text style={styles.bluetoothStatus(bleOpened ? "#47BF34" : "#A8A9AA")}>
          Bluetooth {bleOpened ? "Active" : "Not Active"}
        </Text>
      </View>
      {!bleOpened && (
        <Text style={styles.bluetoothInfo}>Please activate your bluetooth</Text>
      )}
      <Text style={styles.sectionTitle}>
        Printer connected to the PrintModuleLibation:
      </Text>
      {boundAddress.length > 0 && (
        <ItemList
          label={name}
          value={boundAddress}
          onPress={() => unPair(boundAddress)}
          actionText="Disconnect"
          color="#E9493F"
        />
      )}
      {boundAddress.length < 1 && (
        <Text style={styles.printerInfo}>
          There is no printer connected yet
        </Text>
      )}
      <Text style={styles.sectionTitle}>
        Bluetooth connected to this cellphone:
      </Text>
      {loading ? <ActivityIndicator animating={true} /> : null}
      <View style={styles.containerList}>
        {pairedDevices.map((item, index) => {
          return (
            <ItemList
              key={index}
              onPress={() => connect(item)}
              label={item.name}
              value={item.address}
              connected={item.address === boundAddress}
              actionText="Connect"
              color="#00BCD4"
            />
          );
        })}
      </View>
      <SamplePrint />
      <Button onPress={() => scanBluetoothDevice()} title="Scan Bluetooth" />
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

export default PrintModule;
