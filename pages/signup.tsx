import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';

const SignupPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>HRDE - Member Signup</title>
        <meta name="description" content="SSO is required for HRDE access" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container sso-only">
        <div className="auth-modal">
          <div className="logo">
            <Image
              src="/mainLogo.png"
              alt="HRDE"
              width={160}
              height={74}
              style={{ objectFit: 'contain' }}
            />
          </div>

          <div className="sso-message">
            <h2 className="form-title">회원가입이 비활성화되었습니다</h2>
            <p className="sso-description">
              HRDe On Air는 사내 인증 체계를 통해 제공되는 단일 로그인(SSO)만 지원합니다.
              신규 계정은 HRDe 관리자에 의해 프로비저닝되며, 자체 회원가입은 더 이상
              제공되지 않습니다.
            </p>

            <a
              href="https://live.hrdeedu.co.kr/live_made_by_andrew/_manager"
              className="onair-dashboard-button"
            >
              HRDe Dashboard
            </a>

            <p className="sso-helper">
              궁금한 점이 있다면 관리자에게 문의하거나{' '}
              <Link href="/" className="onair-secondary-link">
                메인 페이지
              </Link>
              로 돌아가주세요.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
