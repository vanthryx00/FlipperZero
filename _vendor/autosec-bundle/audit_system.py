#!/usr/bin/env python3
"""
Comprehensive security audit for Flipper Zero and web applications.
Checks for telemetry, tracking, malicious code, and external dependencies.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

class SystemAuditor:
    """Audit Flipper Zero and web applications for security issues."""
    
    # Patterns to detect suspicious code
    SUSPICIOUS_PATTERNS = {
        'telemetry': [
            r'telemetry', r'analytics', r'tracking', r'send.*data',
            r'report.*usage', r'collect.*metrics'
        ],
        'network': [
            r'http.*request', r'socket', r'curl', r'mqtt', r'websocket'
        ],
        'malware': [
            r'system\(', r'exec\(', r'eval\(', r'backdoor', r'exploit'
        ],
        'credentials': [
            r'password.*=', r'api.*key.*=', r'secret.*=', r'token.*='
        ]
    }
    
    def __init__(self, project_path):
        self.project_path = Path(project_path)
        self.results = defaultdict(list)
        self.dependencies = defaultdict(set)
    
    def audit_c_files(self):
        """Audit C source files for suspicious patterns."""
        c_files = list(self.project_path.rglob('*.c'))
        
        for c_file in c_files:
            with open(c_file, 'r', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
            
            # Check includes
            includes = re.findall(r'#include\s+[<"]([^>"]+)[>"]', content)
            self.dependencies['c_includes'].update(includes)
            
            # Check for suspicious patterns
            for category, patterns in self.SUSPICIOUS_PATTERNS.items():
                for pattern in patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        line_num = content[:match.start()].count('\n') + 1
                        if not content[max(0, match.start()-2):match.start()].startswith('//'):
                            self.results[category].append({
                                'file': str(c_file),
                                'line': line_num,
                                'pattern': pattern
                            })
    
    def audit_npm_packages(self):
        """Audit npm packages for suspicious dependencies."""
        package_json = self.project_path / 'package.json'
        
        if not package_json.exists():
            return
        
        with open(package_json, 'r') as f:
            data = json.load(f)
        
        suspicious_packages = [
            'analytics', 'tracking', 'telemetry', 'mixpanel', 'segment',
            'google-analytics', 'facebook-pixel', 'twitter-pixel'
        ]
        
        all_deps = {}
        all_deps.update(data.get('dependencies', {}))
        all_deps.update(data.get('devDependencies', {}))
        
        for pkg_name in all_deps:
            self.dependencies['npm_packages'].add(pkg_name)
            
            if any(susp in pkg_name.lower() for susp in suspicious_packages):
                self.results['suspicious_npm'].append({
                    'package': pkg_name,
                    'reason': 'Matches suspicious package pattern'
                })
    
    def generate_report(self):
        """Generate audit report."""
        report = {
            'status': 'CLEAN',
            'issues': {},
            'dependencies': {}
        }
        
        # Check for issues
        for category, issues in self.results.items():
            if issues:
                report['status'] = 'ISSUES_FOUND'
                report['issues'][category] = issues
        
        # Convert dependencies to list for JSON serialization
        for category, deps in self.dependencies.items():
            report['dependencies'][category] = sorted(list(deps))
        
        return report
    
    def run(self):
        """Run complete audit."""
        self.audit_c_files()
        self.audit_npm_packages()
        return self.generate_report()

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python audit_system.py <project_path>")
        sys.exit(1)
    
    project_path = sys.argv[1]
    auditor = SystemAuditor(project_path)
    report = auditor.run()
    
    print(json.dumps(report, indent=2))
    
    if report['status'] == 'CLEAN':
        print("\n✓ System audit passed - No issues detected")
        return 0
    else:
        print(f"\n⚠ System audit found issues in: {', '.join(report['issues'].keys())}")
        return 1

if __name__ == "__main__":
    exit(main())
