# Web Application Deployment and Integration Guide

## Architecture Overview

The automotive security research platform uses a full-stack architecture:

- **Frontend**: React 19 + Tailwind CSS 4 + Vite
- **Backend**: Express.js + tRPC + TypeScript
- **Database**: MySQL/TiDB with Drizzle ORM
- **Storage**: AWS S3 for firmware files
- **Authentication**: Manus OAuth

## tRPC API Procedures

### Device Management

```typescript
// Detect connected devices
flasher.detectDevices.query()

// Get device status
flasher.getDeviceStatus.query({ deviceId: string })

// Get device capabilities
flasher.getDeviceCapabilities.query({ deviceId: string })
```

### Firmware Operations

```typescript
// Upload firmware file
flasher.uploadFirmware.mutation({ 
  file: File, 
  deviceType: string,
  version: string 
})

// List available firmware
flasher.listFirmware.query({ deviceType?: string })

// Get firmware download URL
flasher.getFirmwareUrl.query({ firmwareId: string })
```

### Flashing Operations

```typescript
// Start flashing process
flasher.startFlashing.mutation({
  deviceId: string,
  firmwareId: string,
  method: 'usb' | 'wireless' | 'sd_card'
})

// Update flashing progress
flasher.updateFlashingProgress.mutation({
  flashingId: string,
  progress: number,
  status: string
})

// Get flashing history
flasher.getFlashingHistory.query({ 
  limit?: number,
  offset?: number 
})
```

### Backup Operations

```typescript
// Backup current firmware
flasher.backupFirmware.mutation({
  deviceId: string,
  backupName: string
})

// Restore from backup
flasher.restoreFirmware.mutation({
  deviceId: string,
  backupId: string
})
```

## Database Schema

### Firmware Files Table

```sql
CREATE TABLE firmware_files (
  id VARCHAR(36) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  storage_url VARCHAR(512) NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  file_size BIGINT NOT NULL,
  checksum VARCHAR(64),
  upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  created_by VARCHAR(36)
);
```

### Flashing History Table

```sql
CREATE TABLE flashing_history (
  id VARCHAR(36) PRIMARY KEY,
  firmware_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(100),
  device_type VARCHAR(50),
  flashing_method VARCHAR(20),
  status VARCHAR(20),
  progress_percentage INT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY (firmware_id) REFERENCES firmware_files(id)
);
```

### Backup Storage Table

```sql
CREATE TABLE backup_storage (
  id VARCHAR(36) PRIMARY KEY,
  device_id VARCHAR(100),
  backup_name VARCHAR(255),
  storage_key VARCHAR(255),
  storage_url VARCHAR(512),
  backup_size BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36)
);
```

## Frontend Components

### Device Selection
- Auto-detect connected devices
- Display device status and battery
- Show firmware version
- Device capabilities indicator

### Firmware Management
- Upload new firmware files
- List available firmware
- Filter by device type
- Show file metadata

### Flashing Control
- Select flashing method (USB, wireless, SD card)
- Start/stop flashing
- Real-time progress display
- Status messaging

### Advanced Options
- Backup verification
- Backup location selection
- Custom parameters
- Safety warnings

## Security Implementation

### Authentication Flow
1. User clicks login
2. Redirected to Manus OAuth
3. User authenticates
4. OAuth callback creates session
5. Session cookie set
6. User authenticated for API calls

### Authorization
- Protected procedures check `ctx.user`
- Admin procedures check `ctx.user.role === 'admin'`
- Resource-level checks in procedures
- Audit logging for sensitive operations

### Input Validation
- Zod schemas for all inputs
- Type checking at compile time
- Range validation
- Format validation
- SQL injection prevention via ORM

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] S3 bucket created and configured
- [ ] OAuth credentials set up
- [ ] SSL certificates installed
- [ ] CORS configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan ready

## Performance Optimization

### Frontend
- Code splitting with Vite
- Lazy loading of components
- React Query caching
- Optimistic updates
- Image optimization

### Backend
- Database connection pooling
- Query optimization
- Caching layer
- Batch operations
- Compression

### Storage
- S3 presigned URLs
- CloudFront CDN
- Multipart uploads
- Lifecycle policies

## Monitoring and Logging

### Application Logs
- Request/response logging
- Error tracking
- Performance metrics
- User activity

### Database Logs
- Query performance
- Connection issues
- Transaction logs

### Storage Logs
- Upload/download activity
- Access patterns
- Error tracking

## Disaster Recovery

### Backup Strategy
- Daily database backups
- S3 versioning enabled
- Cross-region replication
- Point-in-time recovery

### Recovery Procedures
- Database restore from backup
- S3 file recovery
- Session recovery
- User data recovery

## Scaling Considerations

### Horizontal Scaling
- Load balancing
- Database replication
- Session management
- Distributed caching

### Vertical Scaling
- Larger instances
- Database optimization
- Memory management
- CPU optimization

## Troubleshooting

### Common Issues

**Device not detected**
- Check USB connection
- Verify device drivers
- Check device logs

**Flashing fails**
- Verify firmware integrity
- Check device battery
- Review error logs
- Try different method

**Upload errors**
- Check file size
- Verify S3 permissions
- Check network connection
- Review S3 logs

**Database issues**
- Check connection string
- Verify credentials
- Review database logs
- Check disk space
