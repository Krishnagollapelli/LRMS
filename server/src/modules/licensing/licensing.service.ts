import { execSync } from 'child_process';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../utils/db.js';

export class LicensingService {
  private static SECRET_KEY = 'lrms_developer_signature_secret_key_9988!';

  /**
   * Generates a unique hardware fingerprint for the active machine.
   * Runs wmic / reg queries with safe fallback mechanisms.
   */
  public static async getMachineFingerprint(): Promise<string> {
    let cpuId = 'CPU-FALLBACK';
    let boardSerial = 'BOARD-FALLBACK';
    let diskSerial = 'DISK-FALLBACK';
    let machineGuid = 'GUID-FALLBACK';

    try {
      if (process.platform === 'win32') {
        // Query CPU ID
        try {
          const out = execSync('wmic cpu get processorid', { encoding: 'utf8' });
          const lines = out.split('\n').map(l => l.trim()).filter(l => l && l !== 'ProcessorId');
          if (lines.length > 0) cpuId = lines[0];
        } catch (e) {}

        // Query Motherboard Serial
        try {
          const out = execSync('wmic baseboard get serialnumber', { encoding: 'utf8' });
          const lines = out.split('\n').map(l => l.trim()).filter(l => l && l !== 'SerialNumber');
          if (lines.length > 0) boardSerial = lines[0];
        } catch (e) {}

        // Query Disk Serial
        try {
          const out = execSync('wmic diskdrive get serialnumber', { encoding: 'utf8' });
          const lines = out.split('\n').map(l => l.trim()).filter(l => l && l !== 'SerialNumber');
          if (lines.length > 0) diskSerial = lines[0];
        } catch (e) {}

        // Query Windows MachineGuid
        try {
          const out = execSync('reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf8' });
          const match = out.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/);
          if (match) machineGuid = match[1];
        } catch (e) {}
      } else {
        // Simple non-Windows fallback
        machineGuid = process.env.COMPUTERNAME || process.env.HOSTNAME || 'NON-WINDOWS-HOST';
      }
    } catch (error) {
      logger.error('Error generating hardware identifiers:', error);
    }

    const rawString = `${cpuId}:${boardSerial}:${diskSerial}:${machineGuid}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  /**
   * Verify if the license is valid, hasn't expired, and matches this machine's fingerprint.
   */
  public static async verifyLicense(clientFingerprint?: string): Promise<{ isValid: boolean; message: string; details?: any }> {
    try {
      const localFingerprint = clientFingerprint || await this.getMachineFingerprint();

      // 1. Check database-driven DeviceActivation first
      const dbDevice = await prisma.deviceActivation.findUnique({
        where: { fingerprint: localFingerprint }
      });

      if (dbDevice) {
        if (dbDevice.status === 'APPROVED') {
          if (dbDevice.expiryDate && new Date(dbDevice.expiryDate).getTime() < Date.now()) {
            return { isValid: false, message: `License subscription expired on ${new Date(dbDevice.expiryDate).toLocaleDateString()}.` };
          }
          return {
            isValid: true,
            message: 'License active & verified (Cloud Approved).',
            details: { labName: dbDevice.labName, expiryDate: dbDevice.expiryDate ? dbDevice.expiryDate.toISOString() : 'Perpetual' }
          };
        } else if (dbDevice.status === 'BLOCKED') {
          return { isValid: false, message: 'This device hardware fingerprint has been BLOCKED by the Super Admin.' };
        }
      } else {
        // Auto-register this device as PENDING on first verify attempt
        try {
          const hostname = process.env.COMPUTERNAME || process.env.HOSTNAME || 'Unknown Laptop';
          await prisma.deviceActivation.create({
            data: {
              labName: `Unactivated Device (${hostname})`,
              fingerprint: localFingerprint,
              status: 'PENDING'
            }
          });
          logger.info(`Auto-registered new hardware fingerprint as PENDING: ${localFingerprint}`);
        } catch (e) {
          // Ignore unique constraint race conditions
        }
      }

      // 2. Fallback to settings-based offline Base64 activation key validation
      const setting = await prisma.setting.findUnique({
        where: { key: 'license_key' }
      });

      if (!setting) {
        return { isValid: false, message: 'No active license. Connection registered. Please contact your software provider.' };
      }

      const licenseObj = JSON.parse(setting.value);
      const { labName, expiryDate, fingerprint, perpetual, signature } = licenseObj;

      if (!signature) {
        return { isValid: false, message: 'Invalid license signature format.' };
      }

      const contentToSign = JSON.stringify({ labName, expiryDate, fingerprint, perpetual });
      const expectedSignature = crypto.createHmac('sha256', this.SECRET_KEY).update(contentToSign).digest('hex');

      if (signature !== expectedSignature) {
        return { isValid: false, message: 'License key signature mismatch. Code tampering detected.' };
      }

      if (fingerprint !== localFingerprint) {
        return { isValid: false, message: 'License is bound to another machine. Transfer required.' };
      }

      if (!perpetual) {
        const exp = new Date(expiryDate);
        if (exp.getTime() < Date.now()) {
          return { isValid: false, message: `License subscription expired on ${exp.toLocaleDateString()}.` };
        }
      }

      return {
        isValid: true,
        message: 'License active & verified.',
        details: { labName, expiryDate: perpetual ? 'Perpetual' : expiryDate }
      };
    } catch (err: any) {
      logger.error('License verification failed:', err);
      return { isValid: false, message: 'Error checking license: ' + err.message };
    }
  }

  /**
   * Decodes, verifies and registers an activation key payload.
   */
  public static async activateLicense(keyBase64: string): Promise<{ success: boolean; message: string }> {
    try {
      const jsonStr = Buffer.from(keyBase64, 'base64').toString('utf8');
      const licenseObj = JSON.parse(jsonStr);

      const { labName, expiryDate, fingerprint, perpetual, signature } = licenseObj;

      // Re-sign to verify authenticity
      const contentToSign = JSON.stringify({ labName, expiryDate, fingerprint, perpetual });
      const expectedSignature = crypto.createHmac('sha256', this.SECRET_KEY).update(contentToSign).digest('hex');

      if (signature !== expectedSignature) {
        return { success: false, message: 'Activation key has an invalid developer signature.' };
      }

      // Verify fingerprint matches this machine
      const localFingerprint = await this.getMachineFingerprint();
      if (fingerprint !== localFingerprint) {
        return { success: false, message: 'Activation key was generated for another machine.' };
      }

      // Check expiry date if not perpetual
      if (!perpetual && new Date(expiryDate).getTime() < Date.now()) {
        return { success: false, message: 'Cannot activate: Expiry date is in the past.' };
      }

      // Save to settings
      await prisma.setting.upsert({
        where: { key: 'license_key' },
        update: { value: JSON.stringify(licenseObj) },
        create: { key: 'license_key', value: JSON.stringify(licenseObj) }
      });

      return { success: true, message: `Successfully activated license for "${labName}"!` };
    } catch (err: any) {
      logger.error('Error activating license key:', err);
      return { success: false, message: 'Failed to parse activation key: ' + err.message };
    }
  }

  /**
   * Helper function to generate an activation key (used by Developers/Super Admins).
   */
  public static generateActivationKey(labName: string, fingerprint: string, expiryDate: string, perpetual: boolean): string {
    const payload: any = {
      labName,
      expiryDate,
      fingerprint,
      perpetual
    };
    const contentToSign = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', this.SECRET_KEY).update(contentToSign).digest('hex');
    payload.signature = signature;

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  public static async listDevices() {
    return prisma.deviceActivation.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async approveDevice(id: string, labName: string, expiryDate?: string) {
    return prisma.deviceActivation.update({
      where: { id },
      data: {
        labName,
        status: 'APPROVED',
        expiryDate: expiryDate ? new Date(expiryDate) : null
      }
    });
  }

  public static async blockDevice(id: string) {
    return prisma.deviceActivation.update({
      where: { id },
      data: {
        status: 'BLOCKED'
      }
    });
  }

  public static async deleteDevice(id: string) {
    return prisma.deviceActivation.delete({
      where: { id }
    });
  }
}
