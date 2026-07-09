import { prisma } from '../../utils/db.js';
import { logger } from '../../utils/logger.js';

export class LicensingService {
  /**
   * Validates a device registration for a user during login.
   * Registers the device if the limit is not exceeded.
   */
  public static async validateLoginDevice(userId: string, deviceId: string | undefined, userAgent: string | undefined): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, role: true, licenseId: true }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // If user has no license (e.g. Developer or no license linked), allow bypass
      if (!user.licenseId) {
        return { success: true };
      }

      const license = await prisma.license.findUnique({
        where: { id: user.licenseId },
        include: { devices: true }
      });

      if (!license) {
        return { success: false, error: 'License File Missing. Please contact your software provider.' };
      }

      if (license.status !== 'ACTIVE') {
        return { success: false, error: 'License is currently inactive or suspended.' };
      }

      if (license.expiryDate && new Date(license.expiryDate).getTime() < Date.now()) {
        return { success: false, error: 'License subscription has expired.' };
      }

      if (!deviceId) {
        return { success: false, error: 'Device ID missing from request. Hardware identification is required.' };
      }

      // Check if device is already registered
      const existingDevice = license.devices.find(d => d.id === deviceId);

      if (existingDevice) {
        if (existingDevice.status !== 'ACTIVE') {
          return { success: false, error: 'This device is blocked from accessing the license.' };
        }
        
        // Update last active
        await prisma.registeredDevice.update({
          where: { id: deviceId },
          data: { lastActive: new Date() }
        });
        
        return { success: true };
      }

      // If not registered, check device limit
      const activeDevices = license.devices.filter(d => d.status === 'ACTIVE');
      if (activeDevices.length >= license.maxDevices) {
        // Create audit log for blocked registration
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN_FAILURE',
            details: `Device registration rejected for ${user.username} on device ${deviceId} (Device limit of ${license.maxDevices} reached)`
          }
        });
        return { 
          success: false, 
          error: 'This license is already activated on another device. Contact the software administrator to transfer or reset the license.' 
        };
      }

      // Register new device
      const browserInfo = this.parseBrowserInfo(userAgent);
      const os = this.parseOsInfo(userAgent);

      await prisma.registeredDevice.create({
        data: {
          id: deviceId,
          licenseId: license.id,
          browserInfo,
          os,
          status: 'ACTIVE'
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'NEW_DEVICE_REGISTRATION',
          details: `Registered new device (${browserInfo} on ${os}) for license ${license.labName}`
        }
      });

      return { success: true };
    } catch (err: any) {
      logger.error('Error validating login device:', err);
      return { success: false, error: 'Database check failed: ' + err.message };
    }
  }

  /**
   * Core validator for API requests (middleware guard check)
   */
  public static async verifyDeviceRequest(userId: string | undefined, deviceId: string | undefined): Promise<{ isValid: boolean; message: string }> {
    if (!userId) return { isValid: true, message: 'Unauthenticated bypass' };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { licenseId: true }
    });

    if (!user || !user.licenseId) {
      return { isValid: true, message: 'No license constraints' };
    }

    const license = await prisma.license.findUnique({
      where: { id: user.licenseId }
    });

    if (!license || license.status !== 'ACTIVE') {
      return { isValid: false, message: 'License is inactive or missing.' };
    }

    if (license.expiryDate && new Date(license.expiryDate).getTime() < Date.now()) {
      return { isValid: false, message: 'License subscription has expired.' };
    }

    if (!deviceId) {
      return { isValid: false, message: 'Device ID missing. Access denied.' };
    }

    const registered = await prisma.registeredDevice.findFirst({
      where: { id: deviceId, licenseId: license.id, status: 'ACTIVE' }
    });

    if (!registered) {
      return { isValid: false, message: 'Unauthorized device. Access denied.' };
    }

    // Keep active timestamp updated
    await prisma.registeredDevice.update({
      where: { id: deviceId },
      data: { lastActive: new Date() }
    });

    return { isValid: true, message: 'Device verified.' };
  }

  // Helper utilities
  private static parseBrowserInfo(userAgent: string | undefined): string {
    if (!userAgent) return 'Unknown Browser';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Browser';
  }

  private static parseOsInfo(userAgent: string | undefined): string {
    if (!userAgent) return 'Unknown OS';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh')) return 'Mac OS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'OS';
  }

  // Developer Admin CRUD Helpers
  public static async listLicenses() {
    return prisma.license.findMany({
      include: {
        devices: true,
        _count: { select: { users: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  public static async createLicense(data: { labName: string; licenseType: string; maxDevices: number; expiryDate?: string }) {
    return prisma.license.create({
      data: {
        labName: data.labName,
        licenseType: data.licenseType,
        maxDevices: Number(data.maxDevices),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        status: 'ACTIVE'
      }
    });
  }

  public static async resetLicenseDevices(licenseId: string) {
    await prisma.registeredDevice.deleteMany({
      where: { licenseId }
    });
    return { success: true };
  }

  public static async deleteDevice(deviceId: string) {
    await prisma.registeredDevice.delete({
      where: { id: deviceId }
    });
    return { success: true };
  }

  public static async listLicenseDevices(licenseId: string) {
    return prisma.registeredDevice.findMany({
      where: { licenseId },
      orderBy: { registrationDate: 'desc' }
    });
  }
}
