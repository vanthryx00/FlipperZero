/**
 * WebUSB API Type Definitions
 * Provides TypeScript support for the WebUSB API
 */

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumberMatcher?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBControlTransferParameters {
  requestType: "standard" | "class" | "vendor";
  recipient: "device" | "interface" | "endpoint" | "other";
  request: number;
  value: number;
  index: number;
}

interface USBTransferStatus {
  status: "ok" | "stall" | "babble";
}

interface USBInTransferResult extends USBTransferStatus {
  data: DataView;
}

interface USBOutTransferResult extends USBTransferStatus {
  bytesWritten: number;
}

interface USBIsochronousInTransferResult extends USBTransferStatus {
  data: DataView;
  packets: USBIsochronousInTransferPacket[];
}

interface USBIsochronousOutTransferResult extends USBTransferStatus {
  packets: USBIsochronousOutTransferPacket[];
}

interface USBIsochronousInTransferPacket {
  status: "ok" | "stall" | "babble";
  data: DataView;
}

interface USBIsochronousOutTransferPacket {
  status: "ok" | "stall" | "babble";
  bytesWritten: number;
}

interface USBDevice extends EventTarget {
  readonly usbVersionMajor: number;
  readonly usbVersionMinor: number;
  readonly usbVersionSubminor: number;
  readonly deviceClass: number;
  readonly deviceSubclass: number;
  readonly deviceProtocol: number;
  readonly vendorId: number;
  readonly productId: number;
  readonly deviceVersionMajor: number;
  readonly deviceVersionMinor: number;
  readonly deviceVersionSubminor: number;
  readonly manufacturerName?: string;
  readonly productName?: string;
  readonly serialNumber?: string;
  readonly configuration?: USBConfiguration;
  readonly configurations: USBConfiguration[];
  readonly opened: boolean;

  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
  controlTransferIn(
    setup: USBControlTransferParameters,
    length: number
  ): Promise<USBInTransferResult>;
  controlTransferOut(
    setup: USBControlTransferParameters,
    data?: BufferSource
  ): Promise<USBOutTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  isochronousTransferIn(
    endpointNumber: number,
    lengths: number[]
  ): Promise<USBIsochronousInTransferResult>;
  isochronousTransferOut(
    endpointNumber: number,
    data: BufferSource,
    packetLengths: number[]
  ): Promise<USBIsochronousOutTransferResult>;
  reset(): Promise<void>;
}

interface USBConfiguration {
  readonly configurationValue: number;
  readonly configurationName?: string;
  readonly interfaces: USBInterface[];
}

interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternates: USBAlternateInterface[];
  readonly claimed: boolean;
}

interface USBAlternateInterface {
  readonly alternateSetting: number;
  readonly interfaceClass: number;
  readonly interfaceSubclass: number;
  readonly interfaceProtocol: number;
  readonly interfaceName?: string;
  readonly endpoints: USBEndpoint[];
}

interface USBEndpoint {
  readonly endpointNumber: number;
  readonly direction: "in" | "out";
  readonly type: "bulk" | "interrupt" | "isochronous";
  readonly packetSize: number;
}

interface USBConnectionEvent extends Event {
  readonly device: USBDevice;
}

interface USB extends EventTarget {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  addEventListener(
    type: "connect" | "disconnect",
    listener: (event: USBConnectionEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: "connect" | "disconnect",
    listener: (event: USBConnectionEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
}

interface Navigator {
  readonly usb?: USB;
}
