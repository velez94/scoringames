# 📋 Scoring Games - TODO List

## 🔄 In Progress

### 📱 Phone Number Collection Monitoring
- **Status**: Data Collection Phase
- **Description**: Monitor phone number signup adoption before implementing SMS OTP
- **Current**: Phone field added to signup form ✅
- **Next**: Analyze collection rates and user feedback
- **Timeline**: Monitor for 2-4 weeks
- **Decision Point**: Proceed with SMS OTP based on adoption metrics

## 📝 Pending Tasks

### 🔐 SMS OTP Implementation
- **Priority**: Medium
- **Effort**: 2-4 weeks
- **Dependencies**: Phone number collection analysis
- **Requirements**:
  - [ ] Create new Cognito User Pool with SMS support
  - [ ] Develop user migration strategy
  - [ ] Plan communication to existing users
  - [ ] Implement SMS MFA with optional setting
  - [ ] Test OTP verification flow
  - [ ] Monitor SMS costs and usage patterns
- **Estimated Cost**: $2-26/month depending on user adoption
- **Security Impact**: 99% reduction in account takeovers

### 🎯 Future Enhancements
- [ ] Real-time WebSocket leaderboard updates
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] Multi-language support
- [ ] Competition live streaming integration

## ✅ Completed

### Recent Achievements
- [x] EventBridge decoupling for leaderboard calculations
- [x] Lambda memory optimization (50% cost reduction)
- [x] DynamoDB On-Demand billing optimization
- [x] Category-based score entry workflow
- [x] Analytics "Unknown Athlete" issue fixed
- [x] Mobile responsive design improvements
- [x] Personal Bests UX enhancement
- [x] Athlete leaderboard with category filtering
- [x] Phone number field added to signup form

---

**Last Updated**: October 14, 2025  
**Next Review**: Monitor phone collection metrics weekly
