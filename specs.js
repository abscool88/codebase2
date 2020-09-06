describe('RegressionSuite', function() {
	
	
  it('Test Careers', function() {
	  
    browser.get('https://www.galytix.com/index');
   // browser.sleep(4000);
    
    var careerlink=element(by.xpath("(//*[@class='nav-link'])[9]"));
    expect(careerlink.isDisplayed()).toBe(true);
    careerlink.click();
  
  });
  
  
  
  
  it('Test SearchJob link', function() {
  
     var searchAllJobsLink=element(by.xpath("//*[contains(@href,'careers')]"));
     expect(searchAllJobsLink.isDisplayed()).toBe(true);
     searchAllJobsLink.click();    
  });
  
  
  
  it('Test BrowseJob link', function() {
	  browser.sleep(2000);
    var browsejoblink=element(by.xpath("(//*[@class='job-heading'])[1]"));
    expect(browsejoblink.isDisplayed()).toBe(true);
    browsejoblink.click();
    browser.sleep(2000);
    
  });
    
    
    it('Test firstJob link', function() {
	
     var firstJobLink = element(by.xpath("//a[@data-toggle='modal']"));
      expect(firstJobLink.isDisplayed()).toBe(true);
     firstJobLink.click();
    browser.sleep(2000);
    });
  
    
    it('Test JobForm', function() {
    
    var applyFormPopup = element(by.xpath("(//div[@class='modal-body g-contact-form'])[1]"));
     expect(applyFormPopup.isDisplayed()).toBe(true);
    });
    
    
    it('Test RequiredFields on JobForm link', function() {
     var applyNowbtnOnForm = element(by.xpath("//*[contains(@ng-click,'apply')]"));
     expect(applyNowbtnOnForm.isDisplayed()).toBe(true);
     
     applyNowbtnOnForm.click();
     
     browser.sleep(1000);
     
     
 	let requiredErrorOnFirstname=element(by.xpath("//input[@name='firstName']/following::span[1]"));
 	 expect(requiredErrorOnFirstname.isDisplayed()).toBe(true);
 	let requiredErrorOnLastname=element(by.xpath("//input[@name='lastName']/following::span[1]"));
	 expect(requiredErrorOnLastname.isDisplayed()).toBe(true);

 	let requiredErrorOnEmail=element(by.xpath("//input[@name='email']/following::span[1]"));
	 expect(requiredErrorOnEmail.isDisplayed()).toBe(true);

 	let requiredErrorOnMobile=element(by.xpath("//input[@name='phone']/following::span[1]"));
	 expect(requiredErrorOnMobile.isDisplayed()).toBe(true);

 	let requiredErrorOnResident=element(by.xpath("//input[@name='state']/following::span[1]"));
	 expect(requiredErrorOnResident.isDisplayed()).toBe(true);

 	let requiredErrorOnCity=element(by.xpath("//input[@name='city']/following::span[1]"));
	 expect(requiredErrorOnCity.isDisplayed()).toBe(true);

 	let requiredErrorOnCTC=element(by.xpath("//input[@name='currentCTC']/following::span[1]"));
	 expect(requiredErrorOnCTC.isDisplayed()).toBe(true);

 	let requiredErrorOnExpectedCTC=element(by.xpath("//input[@name='expectedCTC']/following::span[1]"));
	 expect(requiredErrorOnExpectedCTC.isDisplayed()).toBe(true);

 	
 	let requiredErrroOnJoinUsTime=element(by.xpath("//input[@name='howSoonCanJoin']/following::span[1]"));
	 expect(requiredErrroOnJoinUsTime.isDisplayed()).toBe(true);

	let requiredErrroOnUploadResume=element(by.name("UploadFile"));
		 expect(requiredErrroOnUploadResume.isDisplayed()).toBe(true);

	 
    });
    



});