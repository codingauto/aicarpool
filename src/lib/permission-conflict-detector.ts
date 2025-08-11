/**
 * 权限冲突检测器
 * 用于检测和解决权限分配中的冲突
 */

export interface PermissionConflict {
  type: 'redundant' | 'conflict' | 'missing_dependency';
  permissions: string[];
  message: string;
  resolution?: string;
}

// 权限层级关系
const PERMISSION_HIERARCHY: Record<string, string[]> = {
  'system.admin': [
    'enterprise.manage',
    'enterprise.view',
    'enterprise.billing',
    'group.manage',
    'group.create',
    'group.view',
    'user.manage',
    'user.invite',
    'user.view',
    'user.remove',
    'ai.manage',
    'ai.use',
    'ai.advanced',
  ],
  'enterprise.manage': [
    'enterprise.view',
    'group.manage',
    'group.create',
    'group.view',
    'user.invite',
    'user.view',
  ],
  'group.manage': [
    'group.view',
    'group.create',
  ],
  'user.manage': [
    'user.view',
    'user.invite',
  ],
  'ai.manage': [
    'ai.use',
    'ai.advanced',
  ],
};

// 权限依赖关系
const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  'enterprise.billing': ['enterprise.manage'],
  'user.remove': ['user.manage'],
  'group.create': ['enterprise.view'],
  'user.invite': ['enterprise.view'],
  'ai.advanced': ['ai.use'],
};

// 互斥权限
const MUTUALLY_EXCLUSIVE_PERMISSIONS: Array<string[]> = [
  // 目前没有互斥权限，但保留扩展性
];

export class PermissionConflictDetector {
  /**
   * 检测权限配置中的所有冲突
   */
  static detectConflicts(permissions: string[]): PermissionConflict[] {
    const conflicts: PermissionConflict[] = [];

    // 检查冗余权限
    conflicts.push(...this.detectRedundantPermissions(permissions));

    // 检查缺失的依赖
    conflicts.push(...this.detectMissingDependencies(permissions));

    // 检查互斥权限
    conflicts.push(...this.detectMutuallyExclusivePermissions(permissions));

    return conflicts;
  }

  /**
   * 检测冗余权限
   * 如果用户有更高级别的权限，则低级别权限是冗余的
   */
  private static detectRedundantPermissions(permissions: string[]): PermissionConflict[] {
    const conflicts: PermissionConflict[] = [];
    const redundantPermissions = new Set<string>();

    permissions.forEach(permission => {
      const impliedPermissions = PERMISSION_HIERARCHY[permission] || [];
      
      impliedPermissions.forEach(implied => {
        if (permissions.includes(implied)) {
          redundantPermissions.add(implied);
        }
      });
    });

    if (redundantPermissions.size > 0) {
      const higherLevelPermissions = permissions.filter(p => 
        PERMISSION_HIERARCHY[p] && 
        PERMISSION_HIERARCHY[p].some(implied => redundantPermissions.has(implied))
      );

      conflicts.push({
        type: 'redundant',
        permissions: Array.from(redundantPermissions),
        message: `以下权限是冗余的，因为已经包含在更高级别的权限中`,
        resolution: `可以移除这些权限，它们已被 ${higherLevelPermissions.join(', ')} 包含`,
      });
    }

    return conflicts;
  }

  /**
   * 检测缺失的依赖权限
   */
  private static detectMissingDependencies(permissions: string[]): PermissionConflict[] {
    const conflicts: PermissionConflict[] = [];
    const missingDependencies = new Map<string, string[]>();

    permissions.forEach(permission => {
      const dependencies = PERMISSION_DEPENDENCIES[permission] || [];
      const missing = dependencies.filter(dep => !permissions.includes(dep));
      
      if (missing.length > 0) {
        missingDependencies.set(permission, missing);
      }
    });

    missingDependencies.forEach((missing, permission) => {
      conflicts.push({
        type: 'missing_dependency',
        permissions: [permission, ...missing],
        message: `权限 "${permission}" 需要以下前置权限: ${missing.join(', ')}`,
        resolution: `添加缺失的权限: ${missing.join(', ')}`,
      });
    });

    return conflicts;
  }

  /**
   * 检测互斥权限
   */
  private static detectMutuallyExclusivePermissions(permissions: string[]): PermissionConflict[] {
    const conflicts: PermissionConflict[] = [];

    MUTUALLY_EXCLUSIVE_PERMISSIONS.forEach(exclusiveGroup => {
      const found = exclusiveGroup.filter(p => permissions.includes(p));
      
      if (found.length > 1) {
        conflicts.push({
          type: 'conflict',
          permissions: found,
          message: `以下权限互斥，不能同时分配: ${found.join(', ')}`,
          resolution: `只保留其中一个权限`,
        });
      }
    });

    return conflicts;
  }

  /**
   * 自动解决权限冲突
   * 返回优化后的权限列表
   */
  static resolveConflicts(permissions: string[]): string[] {
    let optimized = [...permissions];

    // 移除冗余权限
    const redundantConflicts = this.detectRedundantPermissions(optimized);
    redundantConflicts.forEach(conflict => {
      if (conflict.type === 'redundant') {
        optimized = optimized.filter(p => !conflict.permissions.includes(p));
      }
    });

    // 添加缺失的依赖
    const missingConflicts = this.detectMissingDependencies(optimized);
    missingConflicts.forEach(conflict => {
      if (conflict.type === 'missing_dependency') {
        const missing = conflict.permissions.slice(1);
        optimized.push(...missing);
      }
    });

    // 去重
    optimized = [...new Set(optimized)];

    return optimized;
  }

  /**
   * 获取权限的完整权限树
   */
  static getPermissionTree(permission: string): string[] {
    const tree: string[] = [permission];
    const implied = PERMISSION_HIERARCHY[permission] || [];
    
    implied.forEach(p => {
      tree.push(...this.getPermissionTree(p));
    });

    return [...new Set(tree)];
  }

  /**
   * 验证权限组合的有效性
   */
  static validatePermissions(permissions: string[]): {
    valid: boolean;
    conflicts: PermissionConflict[];
    suggestions: string[];
  } {
    const conflicts = this.detectConflicts(permissions);
    const valid = conflicts.length === 0;
    const suggestions: string[] = [];

    // 生成建议
    if (!valid) {
      const optimized = this.resolveConflicts(permissions);
      if (JSON.stringify(optimized.sort()) !== JSON.stringify(permissions.sort())) {
        suggestions.push(`建议的权限组合: ${optimized.join(', ')}`);
      }
    }

    return { valid, conflicts, suggestions };
  }
}