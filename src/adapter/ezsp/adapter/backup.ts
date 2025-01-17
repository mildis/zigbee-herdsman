/* istanbul ignore file */
import Debug from "debug";
import {Driver} from '../driver';
import * as Models from "../../../models";
import {
    EmberKeyType,
    EmberKeyStruct,
    EmberNetworkParameters,
    EmberSecurityManagerNetworkKeyInfo,
    EmberKeyData
} from '../driver/types';
import {channelsMask2list} from '../driver/utils';


export class EZSPAdapterBackup {
    private driver: Driver;
    private defaultPath: string;
    private debug = Debug("zigbee-herdsman:adapter:ezsp:backup");

    public constructor(driver: Driver, path: string) {
        this.driver = driver;
        this.defaultPath = path;
    }

    public async createBackup(): Promise<Models.Backup> {
        this.debug("creating backup");
        const version: number = await this.driver.ezsp.version();
        const linkResult = await this.driver.getKey(EmberKeyType.TRUST_CENTER_LINK_KEY);
        const netParams = await this.driver.ezsp.execCommand('getNetworkParameters');
        const networkParams: EmberNetworkParameters = netParams.parameters;
        const netResult = await this.driver.getKey(EmberKeyType.CURRENT_NETWORK_KEY);
        let tclKey: Buffer = null;
        let netKey: Buffer = null;
        let netKeySequenceNumber: number = 0;
        let netKeyFrameCounter: number = 0;

        if (version < 13) {
            tclKey = Buffer.from((linkResult.keyStruct as EmberKeyStruct).key.contents);
            netKey = Buffer.from((netResult.keyStruct as EmberKeyStruct).key.contents);
            netKeySequenceNumber = (netResult.keyStruct as EmberKeyStruct).sequenceNumber;
            netKeyFrameCounter = (netResult.keyStruct as EmberKeyStruct).outgoingFrameCounter;
        } else {
            tclKey = Buffer.from((linkResult.keyData as EmberKeyData).contents);
            netKey = Buffer.from((netResult.keyData as EmberKeyData).contents);
            // get rest of info from second cmd in EZSP 13+
            const netKeyInfoResult = await this.driver.getNetworkKeyInfo();
            const networkKeyInfo : EmberSecurityManagerNetworkKeyInfo = netKeyInfoResult.networkKeyInfo;
            netKeySequenceNumber = networkKeyInfo.networkKeySequenceNumber;
            netKeyFrameCounter = networkKeyInfo.networkKeyFrameCounter;
        }

        const ieee = (await this.driver.ezsp.execCommand('getEui64')).eui64;
        /* return backup structure */
        /* istanbul ignore next */
        return {
            ezsp: {
                version: version,
                hashed_tclk: tclKey,
            },
            networkOptions: {
                panId: networkParams.panId,
                extendedPanId: Buffer.from(networkParams.extendedPanId),
                channelList: channelsMask2list(networkParams.channels),
                networkKey: netKey,
                networkKeyDistribute: true,
            },
            logicalChannel: networkParams.radioChannel,
            networkKeyInfo: {
                sequenceNumber: netKeySequenceNumber,
                frameCounter: netKeyFrameCounter
            },
            securityLevel: 5,
            networkUpdateId: networkParams.nwkUpdateId,
            coordinatorIeeeAddress: ieee,
            devices: []
        };
    }
}