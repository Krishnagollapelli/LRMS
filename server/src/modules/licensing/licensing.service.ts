import { execSync } from 'child_process';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../utils/db.js';

export class LicensingService {
  // 2048-bit RSA Public Key embedded in the application
  private static PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqP1ZbMAF0G5C6P+9X88Q
KK8dKBUj5qg6J62QG6VZvLkk/asTm2DzfXRHqzOte538+IZbTa7m9NlwByRQ0ysF
GAosQu++/Z8volXtIO5hXfjQyxaQqsH6Q25xG777oe3FFBOOjND9cmYqnhofclXS
XS76VRrJFDwR1lOQaNpEjpKgdfB5b7Y3CZFE9gDojvNFX39hW+QGqkWdjtFriHAa
xNWvSWBhfL3MV1ZtUStx6Kl0+0NUlfjANEvGTa5VA/d6wA74dYLVnrboj5eFomUV
D3xdQmJWwPceyV39h/7u01M3xraQt0LxiV2Zt6bLQZHwL1xqUKTPY1aMcKb0RDVA
CQIDAQAB
-----END PUBLIC KEY-----`;

  /**
   * Helper to normalize hardware strings to prevent formatting/encoding issues
   */
  private static normalizeString(val: string, fallback: string): string {
    if (!val) return fallback;
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase();
    return clean.length > 0 ? clean : fallback;
  }

  /**
   * Generates a unique hardware fingerprint for the active machine.
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
        machineGuid = process.env.COMPUTERNAME || process.env.HOSTNAME || 'NON-WINDOWS-HOST';
      }
    } catch (error) {
      logger.error('Error generating hardware identifiers:', error);
    }

    // Normalize all variables to prevent formatting failures
    const normCpu = this.normalizeString(cpuId, 'CPUFALLBACK');
    const normBoard = this.normalizeString(boardSerial, 'BOARDFALLBACK');
    const normDisk = this.normalizeString(diskSerial, 'DISKFALLBACK');
    const normGuid = this.normalizeString(machineGuid, 'GUIDFALLBACK');

    const rawString = `${normCpu}:${normBoard}:${normDisk}:${normGuid}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  /**
   * Verify if the license is valid, hasn't expired, and matches this machine's fingerprint.
   * Supports Developer, Demo (Web), and Production (Electron) modes.
   */
  public static async verifyLicense(clientFingerprint?: string, clientType?: string): Promise<{ isValid: boolean; message: string; details?: any }> {
    try {
      // 1. Developer Environment Bypass
      if (process.env.NODE_ENV !== 'production' || process.env.DEV_MODE === 'true') {
        logger.info('[Licensing System] Developer Environment detected. Bypassing activation.');
        return {
          isValid: true,
          message: 'Developer Mode active (Licensing Bypassed).',
          details: { developer: true }
        };
      }

      // 2. Browser Demo Mode Bypass
      if (clientType !== 'Electron') {
        logger.info('[Licensing System] Browser environment detected. Running in Demo Mode.');
        return {
          isValid: true,
          message: 'Demo Mode active. Desktop activation is only available in the Electron Desktop Application.',
          details: { demo: true }
        };
      }

      const localFingerprint = clientFingerprint || await this.getMachineFingerprint();

      // 3. Check database-driven DeviceActivation first (Cloud Instant Approval)
      const dbDevice = await prisma.deviceActivation.findUnique({
        where: { fingerprint: localFingerprint }
      });

      if (dbDevice) {
        if (dbDevice.status === 'APPROVED') {
          if (dbDevice.expiryDate && new Date(dbDevice.expiryDate).getTime() < Date.now()) {
            return { isValid: false, message: `Expired License. Subscription ended on ${new Date(dbDevice.expiryDate).toLocaleDateString()}.` };
          }
          return {
            isValid: true,
            message: 'License active & verified (Instant Cloud Activation).',
            details: { labName: dbDevice.labName, expiryDate: dbDevice.expiryDate ? dbDevice.expiryDate.toISOString() : 'Perpetual' }
          };
        } else if (dbDevice.status === 'BLOCKED') {
          return { isValid: false, message: 'Unsupported Machine. This device hardware fingerprint has been BLOCKED.' };
        }
      } else {
        // Auto-register new laptops as PENDING
        try {
          const hostname = process.env.COMPUTERNAME || process.env.HOSTNAME || 'Client Laptop';
          await prisma.deviceActivation.create({
            data: {
              labName: `Unactivated Device (${hostname})`,
              fingerprint: localFingerprint,
              status: 'PENDING'
            }
          });
          logger.info(`Auto-registered new hardware fingerprint as PENDING: ${localFingerprint}`);
        } catch (e) {
          // Ignore unique constraint races
        }
      }

      // 4. Fallback to offline Base64 activation key signature verification (Asymmetric Cryptography)
      const setting = await prisma.setting.findUnique({
        where: { key: 'license_key' }
      });

      if (!setting) {
        return { isValid: false, message: 'License File Missing. Please register an activation key.' };
      }

      let licenseObj: any = {};
      try {
        licenseObj = JSON.parse(setting.value);
      } catch (e) {
        return { isValid: false, message: 'Corrupted Activation Key. Invalid JSON data format.' };
      }

      const { labName, expiryDate, fingerprint, perpetual, signature } = licenseObj;

      if (!signature) {
        return { isValid: false, message: 'Invalid Signature. Cryptographic signature missing.' };
      }

      // Verify the cryptographic signature using the RSA Public Key
      const contentToSign = JSON.stringify({ labName, expiryDate, fingerprint, perpetual });
      try {
        const verify = crypto.createVerify('SHA256');
        verify.update(contentToSign);
        verify.end();
        
        const isSignatureValid = verify.verify(this.PUBLIC_KEY, signature, 'hex');
        if (!isSignatureValid) {
          return { isValid: false, message: 'Invalid Signature. License key signature mismatch.' };
        }
      } catch (err) {
        return { isValid: false, message: 'Corrupted Activation Key. Public Key validation failed.' };
      }

      // Validate fingerprint match
      if (fingerprint !== localFingerprint) {
        return { isValid: false, message: 'Machine Fingerprint Mismatch. This key is bound to another hardware profile.' };
      }

      // Validate expiry date if not perpetual
      if (!perpetual) {
        const exp = new Date(expiryDate);
        if (exp.getTime() < Date.now()) {
          return { isValid: false, message: `Expired License. Subscription ended on ${exp.toLocaleDateString()}.` };
        }
      }

      logger.info(`[Licensing System] License successfully validated for "${labName}".`);
      return {
        isValid: true,
        message: 'License active & verified.',
        details: { labName, expiryDate: perpetual ? 'Perpetual' : expiryDate }
      };
    } catch (err: any) {
      logger.error('License verification failed:', err);
      return { isValid: false, message: 'Fingerprint Calculation Failed: ' + err.message };
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

      // Verify signature using the RSA Public Key
      const contentToSign = JSON.stringify({ labName, expiryDate, fingerprint, perpetual });
      const verify = crypto.createVerify('SHA256');
      verify.update(contentToSign);
      verify.end();

      const isSignatureValid = verify.verify(this.PUBLIC_KEY, signature, 'hex');
      if (!isSignatureValid) {
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

  // 2048-bit RSA Private Key held by the developer/server environment for active generation
  private static PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQCo/VlswAXQbkLo
/71fzxAorx0oFSPmqDonrZAbpVm8uST9qxObYPN9dEerM617nfz4hltNrub02XAH
JFDTKwUYCixC7779ny+iVe0g7mFd+NDLFpCqwfpDbnEbvvuh7cUUE46M0P1yZiqe
Gh9yVdJdLvpVGskUPBHWU5Bo2kSOkqB18HlvtjcJkUT2AOiO80Vff2Fb5AaqRZ2O
0WuIcBrE1a9JYGF8vcxXVm1RK3HoqXT7Q1SV+MA0S8ZNrlUD93rADvh1gtWetuiP
l4WiZRUPfF1CYlbA9x7JXf2H/u7TUzfGtpC3QvGJXZm3pstBkfAvXGpQpM9jVoxw
pvRENUAJAgMBAAECgf87kxUzgX6LPFPaUE4yuIy5ywI8XzeI2UWnN0jWdjRsk9i2
lNkUrdkpIRUjBdTi/49vDe6iNEa3ivAzlFnqGABzuSJhdqOeRcBFOoWeVmt89Xqm
Hg5iJIBVxVmarnmHXItdyIc4nXS8H8hmdE8hv5+puiYGWqsItySSqmL+k/QXTocW
/HO0ZATp7CluEhY8VmSZs37M+DDm01wNQo0ZDpOaJ4uik43qF6AsAsudrGNkqKh0
K9oq6Cjn1sLsE6Qi9wQm16drp7zJiBEyfEBqng6NC+zv00dUdKuc6n6q+83cNyiQ
1LF47ANXlRPGn4T5qEO3o7hxLJuK7HqUuppM2+ECgYEA031BZr7yRBSZ9rOSGCGL
dESmpwbgpJio3+n48SkDXxPYt95rfyL1ttDxV4fmW6mhXf/AAnJDbfU4KAjvhmyU
QoGiVuJFuGWyb9ca61IJesUlEgaO2wiwg2qFUE4dl/zYPnXq4dKPEL4VYR8d9IRG
W1XQBQ4cTlohPPyiLYT3/ZECgYEAzI5GAGu3QjnrCS6gaAYV5o4rbQfRDsFunV8C
vARZF22sai/AlF8J66U1qlia4ZS0RAxOr35z3FoHFsqF5WNRxFKubFpW533AGQwE
MaOy5xv0FK1JTHnqavQ68RDPsKHyxAqe+1RrlktduVpFV4YwqcVBZyfibJCQuoUo
a+TuvvkCgYEAud3iJad5CYZFjcBhjB2nDubqw+5SbbXQ7QEXDPMriFrL40Rxmwmh
gyr8gB3qwPJC5HbJTB0Zz8BsuxqnT6+LWSvO/abc+WM/P/V/LgMqW6B5pO7oi+2G
G+j5Awu0DIhlj/dYF2FS5Lb52SJc1DGQF+NB779n9yBVB+FLss+il1ECgYA2qXpJ
WH+DQgjtzjjtM1sc3jb6jtEt2UDe6unHJn5MRXGCerpCq9bx0pcxqzXQPDWjzYol
WWxKoQAt9far4suR4+paaBW7DJ6N0uk3/p+rJIwoDlp9BkM/S36Its5ZTB2ch54O
WXPamM813cqT5fcRFvYwQ7c8/bC/NyAjHO0zuQKBgFRFeUAna6tXmdVluqzALYH4
vuQDJUk8dC07sNrcQx8M55RLuydscBnh2JRqMFO0/KEChl7zGIhYrngLffJHRVD2
siKgu/n6t3ID4t4ee9FDztLBrnj10uvXCuWmmgDnuzoIlIRITYsFwSkjFf/fXbQn
uCJKciXhxDyUwwVRhj6C
-----END PRIVATE KEY-----`;

  public static generateActivationKey(labName: string, fingerprint: string, expiryDate: string, perpetual: boolean): string {
    const payload: any = {
      labName,
      expiryDate,
      fingerprint,
      perpetual
    };
    const contentToSign = JSON.stringify(payload);
    
    const sign = crypto.createSign('SHA256');
    sign.update(contentToSign);
    sign.end();
    const signature = sign.sign(this.PRIVATE_KEY, 'hex');
    
    payload.signature = signature;
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}
